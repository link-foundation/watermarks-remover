/**
 * Provenance metadata in images: C2PA manifests (PNG `caBX`, JPEG APP11
 * JUMBF boxes), XMP packets (where IPTC DigitalSourceType and generator
 * names live), IPTC records, comments and PNG text chunks holding prompts.
 * Removing them never touches pixels. EXIF is kept because its orientation
 * tag changes how the image is displayed.
 *
 * Pixel-domain watermarks (SynthID, Stable Signature, Tree-Ring) cannot be
 * removed without re-rendering the image and are out of scope.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_METADATA_CHUNKS = new Set(['caBX', 'tEXt', 'iTXt', 'zTXt']);

const JPEG_APP1 = 0xe1;
const JPEG_APP11 = 0xeb;
const JPEG_APP13 = 0xed;
const JPEG_COMMENT = 0xfe;
const JPEG_START_OF_SCAN = 0xda;
const JPEG_STANDALONE = new Set([
  0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9,
]);
const XMP_PREFIX = 'http://ns.adobe.com/xap/1.0/';
const EXTENDED_XMP_PREFIX = 'http://ns.adobe.com/xmp/extension/';

/**
 * @typedef {object} ImageResult
 * @property {string} format
 * @property {string[]} removed names of the removed blocks
 * @property {Uint8Array} bytes the image without them
 */

/**
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
const isPng = (bytes) =>
  PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);

/**
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
const isJpeg = (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8;

/**
 * @param {Uint8Array} bytes
 * @param {number} start
 * @param {number} length
 * @returns {string} the bytes read as Latin-1
 */
const ascii = (bytes, start, length) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

/**
 * @param {Uint8Array[]} parts
 * @returns {Uint8Array}
 */
function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/**
 * @param {Uint8Array} bytes a PNG file
 * @returns {ImageResult}
 */
function stripPng(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts = [bytes.subarray(0, PNG_SIGNATURE.length)];
  const removed = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const end = offset + 12 + view.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    if (PNG_METADATA_CHUNKS.has(type)) {
      const keyword =
        type === 'caBX'
          ? 'C2PA manifest'
          : readPngKeyword(bytes, offset + 8, end - 4);
      removed.push(`${type} (${keyword})`);
    } else {
      parts.push(bytes.subarray(offset, end));
    }
    offset = end;
  }
  parts.push(bytes.subarray(offset));
  return { format: 'PNG', removed, bytes: concat(parts) };
}

/** @returns {string} the NUL terminated keyword of a PNG text chunk */
function readPngKeyword(bytes, start, end) {
  const nul = bytes.subarray(start, end).indexOf(0);
  return ascii(bytes, start, nul === -1 ? Math.min(end - start, 79) : nul);
}

/**
 * @param {number} marker
 * @param {Uint8Array} bytes
 * @param {number} dataStart
 * @returns {string|null} what the segment holds, null if it is kept
 */
function jpegMetadataName(marker, bytes, dataStart) {
  if (marker === JPEG_APP11) {
    return 'APP11 (C2PA/JUMBF)';
  }
  if (marker === JPEG_APP13) {
    return 'APP13 (IPTC)';
  }
  if (marker === JPEG_COMMENT) {
    return 'COM (comment)';
  }
  if (marker === JPEG_APP1) {
    const header = ascii(bytes, dataStart, EXTENDED_XMP_PREFIX.length);
    if (header.startsWith(XMP_PREFIX) || header === EXTENDED_XMP_PREFIX) {
      return 'APP1 (XMP)';
    }
  }
  return null;
}

/**
 * @param {Uint8Array} bytes a JPEG file
 * @returns {ImageResult}
 */
function stripJpeg(bytes) {
  const parts = [bytes.subarray(0, 2)];
  const removed = [];
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (JPEG_STANDALONE.has(marker)) {
      parts.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (marker === JPEG_START_OF_SCAN) {
      break;
    }
    const end = offset + 2 + ((bytes[offset + 2] << 8) | bytes[offset + 3]);
    const name = jpegMetadataName(marker, bytes, offset + 4);
    if (name) {
      removed.push(name);
    } else {
      parts.push(bytes.subarray(offset, end));
    }
    offset = end;
  }
  parts.push(bytes.subarray(offset));
  return { format: 'JPEG', removed, bytes: concat(parts) };
}

/**
 * @param {Uint8Array} bytes
 * @returns {ImageResult|null} null for files that are not PNG or JPEG
 */
export function stripImageMetadata(bytes) {
  if (isPng(bytes)) {
    return stripPng(bytes);
  }
  if (isJpeg(bytes)) {
    return stripJpeg(bytes);
  }
  return null;
}
