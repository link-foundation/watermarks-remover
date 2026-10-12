/**
 * Byte level checks: encodings, byte order marks, binary detection, image
 * metadata and the per-file engine. Fixtures are built in code.
 */

import { describe, it, expect } from 'test-anywhere';

import {
  checkFile,
  decode,
  defaultConfig,
  encode,
  normalizeEncoding,
  parseConfig,
  settingsFor,
  stripImageMetadata,
} from '../src/index.js';

const utf8 = (text) => new TextEncoder().encode(text);
const bytesOf = (...parts) =>
  Uint8Array.from(
    parts.flatMap((part) =>
      typeof part === 'string' ? [...utf8(part)] : [...part]
    )
  );
const textOf = (bytes) => new TextDecoder().decode(bytes);
const latin1 = (text) => Uint8Array.from(text, (char) => char.charCodeAt(0));

const UTF8_BOM = [0xef, 0xbb, 0xbf];

describe('decode', () => {
  it('reads UTF-8 with and without a byte order mark', () => {
    expect(decode(utf8('caf\u{00E9}'))).toEqual({
      binary: false,
      text: 'caf\u{00E9}',
      encoding: 'utf-8',
      bom: false,
    });
    expect(decode(bytesOf(UTF8_BOM, 'a'))).toEqual({
      binary: false,
      text: 'a',
      encoding: 'utf-8',
      bom: true,
    });
  });

  it('reads UTF-16 and UTF-32 by their byte order marks', () => {
    const cases = [
      [[0xff, 0xfe, 0x61, 0x00], 'utf-16le'],
      [[0xfe, 0xff, 0x00, 0x61], 'utf-16be'],
      [[0xff, 0xfe, 0x00, 0x00, 0x61, 0x00, 0x00, 0x00], 'utf-32le'],
      [[0x00, 0x00, 0xfe, 0xff, 0x00, 0x00, 0x00, 0x61], 'utf-32be'],
    ];
    for (const [bytes, encoding] of cases) {
      const decoded = decode(Uint8Array.from(bytes));
      expect(decoded.encoding).toBe(encoding);
      expect(decoded.text).toBe('a');
      expect(decoded.bom).toBe(true);
    }
  });

  it('recognises UTF-16 without a byte order mark', () => {
    const le = encode('hello world\n', { encoding: 'utf-16le', bom: false });
    const be = encode('hello world\n', { encoding: 'utf-16be', bom: false });
    expect(decode(le).encoding).toBe('utf-16le');
    expect(decode(be).encoding).toBe('utf-16be');
    expect(decode(be).text).toBe('hello world\n');
  });

  it('falls back to the configured legacy encoding', () => {
    const bytes = latin1('caf\u{00E9} \u{0093}x\u{0094}');
    expect(decode(bytes).encoding).toBe('windows-1252');
    expect(decode(bytes).text).toBe('caf\u{00E9} \u{201C}x\u{201D}');
    const cyrillic = Uint8Array.of(0xcf, 0xf0, 0xe8);
    expect(decode(cyrillic, { fallbackEncoding: 'windows-1251' }).text).toBe(
      '\u{041F}\u{0440}\u{0438}'
    );
  });

  it('treats files with NUL bytes as binary', () => {
    expect(decode(Uint8Array.of(0x01, 0x00, 0x02, 0x03, 0x04)).binary).toBe(
      true
    );
  });
});

describe('encode', () => {
  it('writes every supported encoding back to the same text', () => {
    const text = 'a\u{00E9}\u{20AC}\u{1F600}';
    const plain = encode(text, { encoding: 'utf-8', bom: false });
    expect(decode(plain).text).toBe(text);
    for (const encoding of [
      'utf-8',
      'utf-16le',
      'utf-16be',
      'utf-32le',
      'utf-32be',
    ]) {
      expect(decode(encode(text, { encoding, bom: true })).text).toBe(text);
    }
  });

  it('treats UTF-32 without a byte order mark as binary', () => {
    const bytes = encode('abc', { encoding: 'utf-32le', bom: false });
    expect(decode(bytes).binary).toBe(true);
  });

  it('writes single byte encodings and rejects missing characters', () => {
    expect([
      ...encode('\u{00E9}\u{20AC}', { encoding: 'windows-1252', bom: false }),
    ]).toEqual([0xe9, 0x80]);
    let error = null;
    try {
      encode('\u{0416}', { encoding: 'windows-1252', bom: false });
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof RangeError).toBe(true);
  });
});

describe('normalizeEncoding', () => {
  it('maps labels to canonical names', () => {
    expect(normalizeEncoding('latin1')).toBe('windows-1252');
    expect(normalizeEncoding('UTF8')).toBe('utf-8');
    expect(normalizeEncoding('cp1251')).toBe('windows-1251');
    expect(normalizeEncoding('UTF-32LE')).toBe('utf-32le');
    expect(normalizeEncoding('no-such-encoding')).toBeNull();
  });
});

/**
 * @param {string} type
 * @param {Uint8Array|number[]} data
 * @returns {number[]} a PNG chunk; readers here do not check the CRC
 */
function pngChunk(type, data) {
  const length = data.length;
  return [
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    ...latin1(type),
    ...data,
    0,
    0,
    0,
    0,
  ];
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0]);
const IDAT = pngChunk('IDAT', [0x78, 0x9c, 0x63, 0, 0, 0, 1, 0, 1]);
const IEND = pngChunk('IEND', []);
const CLEAN_PNG = Uint8Array.from([
  ...PNG_SIGNATURE,
  ...IHDR,
  ...IDAT,
  ...IEND,
]);
const MARKED_PNG = Uint8Array.from([
  ...PNG_SIGNATURE,
  ...IHDR,
  ...pngChunk('tEXt', latin1('parameters\0a cat, masterpiece')),
  ...pngChunk('caBX', latin1('jumb....c2pa')),
  ...pngChunk('iTXt', latin1('XML:com.adobe.xmp\0\0\0\0\0<x/>')),
  ...IDAT,
  ...pngChunk('zTXt', latin1('prompt\0\0x')),
  ...IEND,
]);

/**
 * @param {number} marker
 * @param {Uint8Array|number[]} data
 * @returns {number[]} a JPEG segment
 */
const jpegSegment = (marker, data) => [
  0xff,
  marker,
  ((data.length + 2) >> 8) & 0xff,
  (data.length + 2) & 0xff,
  ...data,
];

const JFIF = jpegSegment(0xe0, latin1('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'));
const EXIF = jpegSegment(0xe1, latin1('Exif\0\0MM\0*'));
const SCAN = [...jpegSegment(0xda, [1, 2, 3]), 0x12, 0x34, 0xff, 0xd9];
const MARKED_JPEG = Uint8Array.from([
  0xff,
  0xd8,
  ...JFIF,
  ...EXIF,
  ...jpegSegment(0xe1, latin1('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>')),
  ...jpegSegment(0xeb, latin1('JP\0\0jumbc2pa')),
  ...jpegSegment(0xed, latin1('Photoshop 3.0\0')),
  ...jpegSegment(0xfe, latin1('Generated by an AI model')),
  ...SCAN,
]);
const CLEAN_JPEG = Uint8Array.from([0xff, 0xd8, ...JFIF, ...EXIF, ...SCAN]);

describe('stripImageMetadata', () => {
  it('removes C2PA, XMP and text chunks from PNG images', () => {
    const result = stripImageMetadata(MARKED_PNG);
    expect(result.format).toBe('PNG');
    expect(result.removed).toEqual([
      'tEXt (parameters)',
      'caBX (C2PA manifest)',
      'iTXt (XML:com.adobe.xmp)',
      'zTXt (prompt)',
    ]);
    expect([...result.bytes]).toEqual([...CLEAN_PNG]);
  });

  it('removes C2PA, XMP, IPTC and comments from JPEG images, keeping EXIF', () => {
    const result = stripImageMetadata(MARKED_JPEG);
    expect(result.format).toBe('JPEG');
    expect(result.removed).toEqual([
      'APP1 (XMP)',
      'APP11 (C2PA/JUMBF)',
      'APP13 (IPTC)',
      'COM (comment)',
    ]);
    expect([...result.bytes]).toEqual([...CLEAN_JPEG]);
  });

  it('leaves clean images alone and ignores other files', () => {
    expect(stripImageMetadata(CLEAN_PNG).removed).toEqual([]);
    expect(stripImageMetadata(CLEAN_JPEG).removed).toEqual([]);
    expect(stripImageMetadata(utf8('not an image'))).toBeNull();
  });
});

const DEFAULTS = defaultConfig();
const settings = (path, source) =>
  settingsFor(source ? parseConfig(source) : DEFAULTS, path);
const check = (path, bytes, source, fix = true) =>
  checkFile(path, bytes, settings(path, source), { fix });
const rulesOf = (result) => result.findings.map((found) => found.rule);

describe('checkFile', () => {
  it('passes a clean UTF-8 file', () => {
    const result = check('a.txt', utf8('clean text\n'));
    expect(result).toEqual({
      path: 'a.txt',
      kind: 'text',
      encoding: 'utf-8',
      findings: [],
      fixed: null,
    });
  });

  it('reports positions and the fix in one pass', () => {
    const result = check('a.md', utf8('one\ntwo\u{200B} three\n'));
    expect(result.findings).toEqual([
      {
        path: 'a.md',
        line: 2,
        column: 4,
        rule: 'zero-width',
        severity: 'error',
        message: result.findings[0].message,
        fixable: true,
      },
    ]);
    expect(textOf(result.fixed)).toBe('one\ntwo three\n');
  });

  it('does not write without fix', () => {
    const result = check('a.txt', utf8('a\u{200B}b\n'), '', false);
    expect(rulesOf(result)).toEqual(['zero-width']);
    expect(result.fixed).toBeNull();
  });

  it('converts UTF-16 and legacy files to UTF-8', () => {
    const utf16 = encode('h\u{00E9}llo\n', { encoding: 'utf-16le', bom: true });
    const converted = check('a.txt', utf16);
    expect(rulesOf(converted)).toEqual(['encoding', 'bom']);
    expect([...converted.fixed]).toEqual([...utf8('h\u{00E9}llo\n')]);

    const legacy = check('b.txt', latin1('caf\u{00E9}\n'));
    expect(legacy.encoding).toBe('windows-1252');
    expect(rulesOf(legacy)).toEqual(['encoding']);
    expect(textOf(legacy.fixed)).toBe('caf\u{00E9}\n');
  });

  it('keeps legacy encodings when asked and still fixes the text', () => {
    const result = check(
      'a.txt',
      latin1('caf\u{00E9}\u{00A0}ok\n'),
      'encoding: keep'
    );
    expect(rulesOf(result)).toEqual(['unusual-space']);
    expect([...result.fixed]).toEqual([...latin1('caf\u{00E9} ok\n')]);
  });

  it('removes or requires the byte order mark', () => {
    const removed = check('a.txt', bytesOf(UTF8_BOM, 'a\n'));
    expect(rulesOf(removed)).toEqual(['bom']);
    expect([...removed.fixed]).toEqual([...utf8('a\n')]);

    const required = check('a.txt', utf8('a\n'), 'bom: require');
    expect(rulesOf(required)).toEqual(['bom']);
    expect([...required.fixed]).toEqual([...bytesOf(UTF8_BOM, 'a\n')]);

    expect(
      check('a.txt', bytesOf(UTF8_BOM, 'a\n'), 'bom: keep').findings
    ).toEqual([]);
  });

  it('applies overrides by path', () => {
    const source = "overrides\n  '*.bat'\n    line-endings: crlf";
    expect(check('run.bat', utf8('echo\r\n'), source).findings).toEqual([]);
    const unix = check('run.sh', utf8('echo\r\n'), source);
    expect(rulesOf(unix)).toEqual(['line-endings']);
    expect(textOf(unix.fixed)).toBe('echo\n');
  });

  it('reports nothing for rules that are off', () => {
    const result = check(
      'a.txt',
      utf8('a\u{200B}b'),
      'rules\n  zero-width: off\n  final-newline: off'
    );
    expect(result.findings).toEqual([]);
    expect(result.fixed).toBeNull();
  });

  it('marks warnings with their severity', () => {
    const result = check(
      'a.txt',
      utf8('a\u{200B}b\n'),
      'rules\n  zero-width: warn'
    );
    expect(result.findings[0].severity).toBe('warn');
  });

  it('skips binary and oversized files', () => {
    expect(check('a.bin', Uint8Array.of(1, 0, 2, 0, 3, 4, 0, 0)).kind).toBe(
      'binary'
    );
    const large = check('a.txt', utf8('a\u{200B}\n'), 'max-file-size: 2');
    expect(large.kind).toBe('too-large');
    expect(large.findings).toEqual([]);
  });

  it('reports hidden characters in file names', () => {
    const result = check('docs/re\u{200B}port.md', utf8('ok\n'));
    expect(rulesOf(result)).toEqual(['file-name']);
    expect(result.findings[0].fixable).toBe(false);
    expect(result.findings[0].line).toBe(0);
    expect(
      check('docs/r\u{00E9}sum\u{00E9}.md', utf8('ok\n')).findings
    ).toEqual([]);
  });

  it('strips image metadata', () => {
    const result = check('photo.jpg', MARKED_JPEG);
    expect(result.kind).toBe('image');
    expect(rulesOf(result)).toEqual([
      'image-metadata',
      'image-metadata',
      'image-metadata',
      'image-metadata',
    ]);
    expect([...result.fixed]).toEqual([...CLEAN_JPEG]);
    expect(check('photo.png', CLEAN_PNG).fixed).toBeNull();
    const off = check('photo.png', MARKED_PNG, 'rules\n  image-metadata: off');
    expect(off.findings).toEqual([]);
    expect(off.fixed).toBeNull();
  });
});
