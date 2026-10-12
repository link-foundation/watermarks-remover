/**
 * Byte level handling: telling text from binary, detecting the encoding
 * (byte order marks, UTF-16 by NUL patterns, strict UTF-8, then a
 * configured legacy fallback), and encoding text back to bytes.
 */

const BOMS = [
  { encoding: 'utf-32le', bytes: [0xff, 0xfe, 0x00, 0x00] },
  { encoding: 'utf-32be', bytes: [0x00, 0x00, 0xfe, 0xff] },
  { encoding: 'utf-8', bytes: [0xef, 0xbb, 0xbf] },
  { encoding: 'utf-16le', bytes: [0xff, 0xfe] },
  { encoding: 'utf-16be', bytes: [0xfe, 0xff] },
];

/** How much of a file to look at when guessing whether it is text. */
const SNIFF_LENGTH = 8192;

/**
 * @param {Uint8Array} bytes
 * @returns {{ encoding: string, length: number } | null}
 */
function readBom(bytes) {
  const bom = BOMS.find(({ bytes: mark }) =>
    mark.every((byte, index) => bytes[index] === byte)
  );
  return bom ? { encoding: bom.encoding, length: bom.bytes.length } : null;
}

/**
 * Text in UTF-16 without a BOM still has a NUL in every other byte when it
 * is mostly ASCII, which is the case for source code and configuration.
 *
 * @param {Uint8Array} bytes
 * @returns {'utf-16le'|'utf-16be'|null}
 */
function sniffUtf16(bytes) {
  const length = Math.min(bytes.length, SNIFF_LENGTH) & ~1;
  if (length < 4) {
    return null;
  }
  let evenNuls = 0;
  let oddNuls = 0;
  for (let index = 0; index < length; index += 2) {
    evenNuls += bytes[index] === 0 ? 1 : 0;
    oddNuls += bytes[index + 1] === 0 ? 1 : 0;
  }
  const pairs = length / 2;
  if (oddNuls > pairs * 0.6 && evenNuls < pairs * 0.1) {
    return 'utf-16le';
  }
  if (evenNuls > pairs * 0.6 && oddNuls < pairs * 0.1) {
    return 'utf-16be';
  }
  return null;
}

/**
 * @param {Uint8Array} bytes
 * @returns {boolean} a NUL byte early in the file marks it as binary
 */
const hasNul = (bytes) => bytes.subarray(0, SNIFF_LENGTH).includes(0);

/**
 * @param {Uint8Array} bytes
 * @param {boolean} littleEndian
 * @returns {string}
 */
function decodeUtf32(bytes, littleEndian) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let text = '';
  for (let offset = 0; offset + 4 <= bytes.length; offset += 4) {
    const codePoint = view.getUint32(offset, littleEndian);
    text += String.fromCodePoint(codePoint <= 0x10ffff ? codePoint : 0xfffd);
  }
  return text;
}

/**
 * @param {Uint8Array} bytes
 * @param {string} encoding
 * @returns {string}
 */
function decodeWith(bytes, encoding) {
  if (encoding === 'utf-32le' || encoding === 'utf-32be') {
    return decodeUtf32(bytes, encoding === 'utf-32le');
  }
  return new TextDecoder(encoding, { ignoreBOM: true }).decode(bytes);
}

/**
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
function isUtf8(bytes) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * @typedef {object} Decoded
 * @property {boolean} binary
 * @property {string} [text] content without the byte order mark
 * @property {string} [encoding] WHATWG encoding label
 * @property {boolean} [bom] the file started with a byte order mark
 */

/**
 * @param {Uint8Array} bytes
 * @param {{ fallbackEncoding?: string }} [options]
 * @returns {Decoded}
 */
export function decode(bytes, { fallbackEncoding = 'windows-1252' } = {}) {
  const bom = readBom(bytes);
  if (bom) {
    return {
      binary: false,
      text: decodeWith(bytes.subarray(bom.length), bom.encoding),
      encoding: bom.encoding,
      bom: true,
    };
  }
  const utf16 = sniffUtf16(bytes);
  if (utf16) {
    return {
      binary: false,
      text: decodeWith(bytes, utf16),
      encoding: utf16,
      bom: false,
    };
  }
  if (hasNul(bytes)) {
    return { binary: true };
  }
  const encoding = isUtf8(bytes) ? 'utf-8' : fallbackEncoding;
  return {
    binary: false,
    text: decodeWith(bytes, encoding),
    encoding,
    bom: false,
  };
}

const SINGLE_BYTE_TABLES = new Map();

/**
 * @param {string} encoding a single byte legacy encoding
 * @returns {Map<string, number>} character to byte
 */
export function singleByteTable(encoding) {
  if (!SINGLE_BYTE_TABLES.has(encoding)) {
    const decoder = new TextDecoder(encoding);
    const table = new Map();
    for (let byte = 0xff; byte >= 0; byte -= 1) {
      table.set(decoder.decode(Uint8Array.of(byte)), byte);
    }
    SINGLE_BYTE_TABLES.set(encoding, table);
  }
  return SINGLE_BYTE_TABLES.get(encoding);
}

/**
 * @param {string} text
 * @param {boolean} littleEndian
 * @param {number} width 2 or 4 bytes per unit
 * @returns {Uint8Array}
 */
function encodeWide(text, littleEndian, width) {
  const units =
    width === 2
      ? Array.from({ length: text.length }, (_unused, index) =>
          text.charCodeAt(index)
        )
      : Array.from(text, (char) => char.codePointAt(0));
  const bytes = new Uint8Array(units.length * width);
  const view = new DataView(bytes.buffer);
  units.forEach((unit, index) => {
    if (width === 2) {
      view.setUint16(index * 2, unit, littleEndian);
    } else {
      view.setUint32(index * 4, unit, littleEndian);
    }
  });
  return bytes;
}

/**
 * @param {string} text
 * @param {string} encoding
 * @returns {Uint8Array}
 * @throws {RangeError} when a character has no byte in a legacy encoding
 */
function encodeBody(text, encoding) {
  if (encoding === 'utf-8') {
    return new TextEncoder().encode(text);
  }
  const wide = /^utf-(16|32)(le|be)$/.exec(encoding);
  if (wide) {
    return encodeWide(text, wide[2] === 'le', Number(wide[1]) / 8);
  }
  const table = singleByteTable(encoding);
  return Uint8Array.from(text, (char) => {
    const byte = table.get(char);
    if (byte === undefined) {
      throw new RangeError(
        `${JSON.stringify(char)} cannot be written in ${encoding}`
      );
    }
    return byte;
  });
}

/**
 * @param {string} text
 * @param {{ encoding: string, bom: boolean }} target
 * @returns {Uint8Array}
 */
export function encode(text, { encoding, bom }) {
  const body = encodeBody(text, encoding);
  const mark = bom ? BOMS.find((entry) => entry.encoding === encoding) : null;
  if (!mark) {
    return body;
  }
  const bytes = new Uint8Array(mark.bytes.length + body.length);
  bytes.set(mark.bytes);
  bytes.set(body, mark.bytes.length);
  return bytes;
}

/**
 * @param {string} label
 * @returns {string|null} the canonical encoding name, null if unsupported
 */
export function normalizeEncoding(label) {
  const lower = label.toLowerCase();
  if (/^utf-?32-?(le|be)$/.test(lower)) {
    return lower.replace(/^utf-?32-?/, 'utf-32');
  }
  try {
    return new TextDecoder(lower).encoding;
  } catch {
    return null;
  }
}
