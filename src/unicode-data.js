/**
 * Code point classes used to hide text watermarks, and the narrow contexts
 * in which some of them are load-bearing parts of real writing.
 *
 * Every range here is written as an escape so that this file stays plain
 * ASCII and passes the checks it implements.
 */

/** @typedef {[number, number]} Range inclusive code point range */

/**
 * @param {Range[]} ranges
 * @returns {(codePoint: number) => boolean}
 */
const inRanges = (ranges) => (codePoint) =>
  ranges.some(([low, high]) => codePoint >= low && codePoint <= high);

export const isBidiOverride = inRanges([[0x202d, 0x202e]]);
export const isBidiMark = inRanges([
  [0x061c, 0x061c],
  [0x200e, 0x200f],
]);
export const isBidiEmbedding = inRanges([[0x202a, 0x202b]]);
export const isBidiIsolate = inRanges([[0x2066, 0x2068]]);
export const BIDI_POP_FORMATTING = 0x202c;
export const BIDI_POP_ISOLATE = 0x2069;

export const isBidiControl = (codePoint) =>
  isBidiMark(codePoint) ||
  isBidiEmbedding(codePoint) ||
  isBidiOverride(codePoint) ||
  isBidiIsolate(codePoint) ||
  codePoint === BIDI_POP_FORMATTING ||
  codePoint === BIDI_POP_ISOLATE;

export const ZERO_WIDTH_JOINER = 0x200d;
export const ZERO_WIDTH_NON_JOINER = 0x200c;
export const BYTE_ORDER_MARK = 0xfeff;

export const isZeroWidth = inRanges([
  [0x180e, 0x180e],
  [0x200b, 0x200d],
  [0x2060, 0x2060],
  [0xfeff, 0xfeff],
]);

export const isTagCharacter = inRanges([
  [0xe0001, 0xe0001],
  [0xe0020, 0xe007f],
]);
export const BLACK_FLAG = 0x1f3f4;
export const CANCEL_TAG = 0xe007f;
export const isTagSpec = inRanges([
  [0xe0030, 0xe0039],
  [0xe0061, 0xe007a],
]);

export const isEmojiVariationSelector = inRanges([[0xfe0e, 0xfe0f]]);
export const isStandardVariationSelector = inRanges([[0xfe00, 0xfe0d]]);
export const isIdeographicVariationSelector = inRanges([[0xe0100, 0xe01ef]]);
export const isMongolianVariationSelector = inRanges([
  [0x180b, 0x180d],
  [0x180f, 0x180f],
]);
export const isVariationSelector = (codePoint) =>
  isEmojiVariationSelector(codePoint) ||
  isStandardVariationSelector(codePoint) ||
  isIdeographicVariationSelector(codePoint) ||
  isMongolianVariationSelector(codePoint);

export const isInvisibleOperator = inRanges([[0x2061, 0x2064]]);

export const SOFT_HYPHEN = 0x00ad;
export const COMBINING_GRAPHEME_JOINER = 0x034f;
export const isHangulFiller = inRanges([
  [0x115f, 0x1160],
  [0x3164, 0x3164],
  [0xffa0, 0xffa0],
]);
export const isHangulJamo = inRanges([
  [0x1100, 0x11ff],
  [0xa960, 0xa97f],
  [0xd7b0, 0xd7ff],
]);

/** Arabic, Syriac and Kaithi format characters that render as visible signs. */
export const isPrependedConcatenationMark = inRanges([
  [0x0600, 0x0605],
  [0x06dd, 0x06dd],
  [0x070f, 0x070f],
  [0x0890, 0x0891],
  [0x08e2, 0x08e2],
  [0x110bd, 0x110bd],
  [0x110cd, 0x110cd],
]);

/** Layout controls that only make sense next to their own script. */
export const SCRIPT_LAYOUT_CONTROLS = [
  { test: inRanges([[0x13430, 0x1345f]]), script: 'Egyptian_Hieroglyphs' },
  { test: inRanges([[0x1bca0, 0x1bca3]]), script: 'Duployan' },
  { test: inRanges([[0x1d173, 0x1d17a]]), script: 'Common', musical: true },
];

export const isNoncharacter = (codePoint) =>
  (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
  (codePoint & 0xfffe) === 0xfffe;

export const isPrivateUse = inRanges([
  [0xe000, 0xf8ff],
  [0xf0000, 0xffffd],
  [0x100000, 0x10fffd],
]);

/** Visible-looking blanks: Braille pattern blank and object replacement. */
export const BRAILLE_BLANK = 0x2800;
export const isBraillePattern = inRanges([[0x2801, 0x28ff]]);
export const OBJECT_REPLACEMENT = 0xfffc;
export const REPLACEMENT_CHARACTER = 0xfffd;

/** Spaces that look like U+0020 but are different code points. */
export const isUnusualSpace = inRanges([
  [0x00a0, 0x00a0],
  [0x1680, 0x1680],
  [0x2000, 0x200a],
  [0x202f, 0x202f],
  [0x205f, 0x205f],
  [0x3000, 0x3000],
]);

export const IDEOGRAPHIC_SPACE = 0x3000;
export const NARROW_NO_BREAK_SPACE = 0x202f;

export const LINE_SEPARATORS = new Set([0x0085, 0x2028, 0x2029]);

/** C0 and C1 controls other than tab, line feed and carriage return. */
export const isControlCharacter = (codePoint) =>
  (codePoint < 0x20 &&
    codePoint !== 0x09 &&
    codePoint !== 0x0a &&
    codePoint !== 0x0d) ||
  (codePoint >= 0x7f && codePoint <= 0x9f && codePoint !== 0x85);

export const isFullwidthAlphanumeric = inRanges([
  [0xff10, 0xff19],
  [0xff21, 0xff3a],
  [0xff41, 0xff5a],
]);
export const isFullwidthPunctuation = inRanges([
  [0xff01, 0xff0f],
  [0xff1a, 0xff20],
  [0xff3b, 0xff40],
  [0xff5b, 0xff5e],
]);
export const isMathematicalAlphanumeric = inRanges([[0x1d400, 0x1d7ff]]);
export const isLatinLigature = inRanges([[0xfb00, 0xfb06]]);

/** Typographic punctuation and its plain ASCII spelling. */
export const TYPOGRAPHIC_REPLACEMENTS = new Map([
  [0x2010, '-'],
  [0x2011, '-'],
  [0x2012, '-'],
  [0x2013, '-'],
  [0x2014, '-'],
  [0x2015, '-'],
  [0x2212, '-'],
  [0x2018, "'"],
  [0x2019, "'"],
  [0x201a, "'"],
  [0x201b, "'"],
  [0x2032, "'"],
  [0x201c, '"'],
  [0x201d, '"'],
  [0x201e, '"'],
  [0x201f, '"'],
  [0x2033, '"'],
  [0x2026, '...'],
  [0x2022, '*'],
]);

const SCRIPT_PATTERNS = new Map();

/**
 * @param {string} script Unicode script name, for example `Arabic`
 * @returns {RegExp}
 */
export function scriptPattern(script) {
  if (!SCRIPT_PATTERNS.has(script)) {
    SCRIPT_PATTERNS.set(script, new RegExp(`^\\p{Script=${script}}$`, 'u'));
  }
  return SCRIPT_PATTERNS.get(script);
}

/** Scripts whose orthography relies on ZWJ and ZWNJ between letters. */
export const JOINING_SCRIPTS = [
  'Arabic',
  'Syriac',
  'Nko',
  'Mongolian',
  'Mandaic',
  'Manichaean',
  'Psalter_Pahlavi',
  'Hanifi_Rohingya',
  'Sogdian',
  'Devanagari',
  'Bengali',
  'Gurmukhi',
  'Gujarati',
  'Oriya',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Sinhala',
  'Tibetan',
  'Myanmar',
  'Khmer',
  'Balinese',
  'Javanese',
];

/** Scripts written right to left, where bidi marks are ordinary punctuation. */
export const RIGHT_TO_LEFT_SCRIPTS = [
  'Arabic',
  'Hebrew',
  'Syriac',
  'Thaana',
  'Nko',
  'Samaritan',
  'Mandaic',
  'Adlam',
  'Hanifi_Rohingya',
];

/** Scripts whose text legitimately uses U+3000 and fullwidth punctuation. */
export const CJK_SCRIPTS = [
  'Han',
  'Hiragana',
  'Katakana',
  'Hangul',
  'Bopomofo',
];

/** Scripts that standardized variation sequences FE00..FE0D apply to. */
export const STANDARD_VARIATION_SCRIPTS = [
  'Han',
  'Myanmar',
  'Phags_Pa',
  'Manichaean',
  'Egyptian_Hieroglyphs',
];

export const isLetter = (char) => /^\p{L}$/u.test(char);
export const isMark = (char) => /^\p{M}$/u.test(char);
export const isMathSymbol = (char) => /^\p{Sm}$/u.test(char);
export const isEmojiBase = (char) => /^\p{Emoji}$/u.test(char);
export const isPictographic = (char) =>
  /^\p{Extended_Pictographic}$/u.test(char);
export const isEmojiModifier = (char) => /^\p{Emoji_Modifier}$/u.test(char);
export const isUnassigned = (char) => /^\p{Cn}$/u.test(char);
export const isFormatCharacter = (char) => /^\p{Cf}$/u.test(char);
export const isDefaultIgnorable = (char) =>
  /^\p{Default_Ignorable_Code_Point}$/u.test(char);

/**
 * @param {string} char single code point
 * @returns {string} U+XXXX notation
 */
export const formatCodePoint = (char) =>
  `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

/** Readable names for the code points users meet most often. */
export const CHARACTER_NAMES = new Map([
  [0x00a0, 'NO-BREAK SPACE'],
  [0x00ad, 'SOFT HYPHEN'],
  [0x034f, 'COMBINING GRAPHEME JOINER'],
  [0x061c, 'ARABIC LETTER MARK'],
  [0x115f, 'HANGUL CHOSEONG FILLER'],
  [0x1160, 'HANGUL JUNGSEONG FILLER'],
  [0x180e, 'MONGOLIAN VOWEL SEPARATOR'],
  [0x200b, 'ZERO WIDTH SPACE'],
  [0x200c, 'ZERO WIDTH NON-JOINER'],
  [0x200d, 'ZERO WIDTH JOINER'],
  [0x200e, 'LEFT-TO-RIGHT MARK'],
  [0x200f, 'RIGHT-TO-LEFT MARK'],
  [0x2028, 'LINE SEPARATOR'],
  [0x2029, 'PARAGRAPH SEPARATOR'],
  [0x202a, 'LEFT-TO-RIGHT EMBEDDING'],
  [0x202b, 'RIGHT-TO-LEFT EMBEDDING'],
  [0x202c, 'POP DIRECTIONAL FORMATTING'],
  [0x202d, 'LEFT-TO-RIGHT OVERRIDE'],
  [0x202e, 'RIGHT-TO-LEFT OVERRIDE'],
  [0x202f, 'NARROW NO-BREAK SPACE'],
  [0x205f, 'MEDIUM MATHEMATICAL SPACE'],
  [0x2060, 'WORD JOINER'],
  [0x2061, 'FUNCTION APPLICATION'],
  [0x2062, 'INVISIBLE TIMES'],
  [0x2063, 'INVISIBLE SEPARATOR'],
  [0x2064, 'INVISIBLE PLUS'],
  [0x2066, 'LEFT-TO-RIGHT ISOLATE'],
  [0x2067, 'RIGHT-TO-LEFT ISOLATE'],
  [0x2068, 'FIRST STRONG ISOLATE'],
  [0x2069, 'POP DIRECTIONAL ISOLATE'],
  [0x2800, 'BRAILLE PATTERN BLANK'],
  [0x3000, 'IDEOGRAPHIC SPACE'],
  [0x3164, 'HANGUL FILLER'],
  [0xfe0e, 'VARIATION SELECTOR-15'],
  [0xfe0f, 'VARIATION SELECTOR-16'],
  [0xfeff, 'ZERO WIDTH NO-BREAK SPACE'],
  [0xffa0, 'HALFWIDTH HANGUL FILLER'],
  [0xfffc, 'OBJECT REPLACEMENT CHARACTER'],
  [0xfffd, 'REPLACEMENT CHARACTER'],
]);

/**
 * @param {string} char single code point
 * @returns {string} `U+XXXX NAME`, or just `U+XXXX` for unnamed ones
 */
export function describeCharacter(char) {
  const name = CHARACTER_NAMES.get(char.codePointAt(0));
  return name ? `${formatCodePoint(char)} ${name}` : formatCodePoint(char);
}
