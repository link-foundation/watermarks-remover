/**
 * Runs of invisible characters are reported as one finding, and when the run
 * uses a known smuggling scheme the hidden text is decoded so that a reviewer
 * sees what was carried:
 *
 * - tag characters U+E0020..E007E mirror printable ASCII (ASCII smuggling);
 * - variation selectors map to bytes, U+FE00..FE0F to 0..15 and
 *   U+E0100..E01EF to 16..255 (emoji smuggling, GlassWorm);
 * - U+2062 and U+2064 encode bits 0 and 1 (Sneaky Bits).
 */

import { describeCharacter } from './unicode-data.js';

/** @typedef {import('./characters.js').Edit} Edit */

/** Longest decoded text quoted in a message. */
const MAX_PREVIEW = 120;

/**
 * @param {number[]} bytes
 * @returns {string}
 */
const utf8 = (bytes) => new TextDecoder().decode(Uint8Array.from(bytes));

/**
 * @param {number[]} codePoints
 * @returns {string|null}
 */
function decodeTags(codePoints) {
  const ascii = codePoints
    .filter((codePoint) => codePoint >= 0xe0020 && codePoint <= 0xe007e)
    .map((codePoint) => String.fromCharCode(codePoint - 0xe0000));
  return ascii.length > 0 ? ascii.join('') : null;
}

/**
 * @param {number[]} codePoints
 * @returns {string|null}
 */
function decodeSelectors(codePoints) {
  const bytes = [];
  for (const codePoint of codePoints) {
    if (codePoint >= 0xfe00 && codePoint <= 0xfe0f) {
      bytes.push(codePoint - 0xfe00);
    } else if (codePoint >= 0xe0100 && codePoint <= 0xe01ef) {
      bytes.push(codePoint - 0xe0100 + 16);
    }
  }
  return bytes.length > 1 ? utf8(bytes) : null;
}

/**
 * @param {number[]} codePoints
 * @returns {string|null}
 */
function decodeSneakyBits(codePoints) {
  const bits = codePoints.filter(
    (codePoint) => codePoint === 0x2062 || codePoint === 0x2064
  );
  if (bits.length < 8 || bits.length !== codePoints.length) {
    return null;
  }
  const bytes = [];
  for (let start = 0; start + 8 <= bits.length; start += 8) {
    const byte = bits
      .slice(start, start + 8)
      .reduce((value, bit) => (value << 1) | (bit === 0x2064 ? 1 : 0), 0);
    bytes.push(byte);
  }
  return utf8(bytes);
}

const DECODERS = {
  'tag-character': decodeTags,
  'variation-selector': decodeSelectors,
  'invisible-format': decodeSneakyBits,
};

/**
 * @param {string} text
 * @returns {string} the text with controls, spaces other than U+0020,
 *   private-use and invisible characters escaped as \u{...}
 */
export function escapeInvisible(text) {
  return text.replace(
    /[^\p{L}\p{M}\p{N}\p{P}\p{S}\x20]|\p{Default_Ignorable_Code_Point}/gu,
    (char) => `\\u{${char.codePointAt(0).toString(16).toUpperCase()}}`
  );
}

/**
 * @param {string} decoded
 * @returns {string} a readable, escaped preview
 */
function preview(decoded) {
  const chars = [...decoded];
  const shown = escapeInvisible(chars.slice(0, MAX_PREVIEW).join(''));
  return chars.length > MAX_PREVIEW ? `${shown}...` : shown;
}

/**
 * @param {string} rule
 * @param {string[]} chars the run, one code point per entry
 * @returns {string}
 */
function describeRun(rule, chars) {
  const distinct = [...new Set(chars)];
  const names =
    distinct.length <= 3
      ? distinct.map(describeCharacter).join(', ')
      : `${distinct.slice(0, 3).map(describeCharacter).join(', ')}, ...`;
  const decoded = DECODERS[rule]?.(chars.map((char) => char.codePointAt(0)));
  const payload = decoded ? `; hidden text: "${preview(decoded)}"` : '';
  return `${chars.length} invisible characters (${names})${payload}`;
}

/**
 * Merge adjacent removals of the same rule into one edit per run.
 *
 * @param {string} text
 * @param {Edit[]} edits in text order
 * @returns {Edit[]}
 */
export function mergeRuns(text, edits) {
  const merged = [];
  for (const edit of edits) {
    const last = merged.at(-1);
    if (
      last &&
      last.rule === edit.rule &&
      last.replacement === '' &&
      edit.replacement === '' &&
      last.index + last.length === edit.index
    ) {
      last.length += edit.length;
      last.count += 1;
    } else {
      merged.push({ ...edit, count: 1 });
    }
  }
  return merged.map(({ count, ...edit }) => {
    if (count === 1) {
      return edit;
    }
    const chars = [...text.slice(edit.index, edit.index + edit.length)];
    return { ...edit, message: describeRun(edit.rule, chars) };
  });
}
