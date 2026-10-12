/**
 * Code point level detection. Each code point is classified in the context
 * of its neighbours, so that invisible characters that real writing depends
 * on (emoji sequences, Persian ZWNJ, flag tags, CJK variation selectors,
 * bidi marks in Hebrew or Arabic text) are kept, and everything else that
 * could carry a hidden payload is reported with a replacement.
 */

import {
  BIDI_POP_FORMATTING,
  BRAILLE_BLANK,
  BIDI_POP_ISOLATE,
  BLACK_FLAG,
  CANCEL_TAG,
  CJK_SCRIPTS,
  COMBINING_GRAPHEME_JOINER,
  IDEOGRAPHIC_SPACE,
  JOINING_SCRIPTS,
  LINE_SEPARATORS,
  NARROW_NO_BREAK_SPACE,
  OBJECT_REPLACEMENT,
  REPLACEMENT_CHARACTER,
  RIGHT_TO_LEFT_SCRIPTS,
  SCRIPT_LAYOUT_CONTROLS,
  STANDARD_VARIATION_SCRIPTS,
  TYPOGRAPHIC_REPLACEMENTS,
  ZERO_WIDTH_JOINER,
  ZERO_WIDTH_NON_JOINER,
  describeCharacter,
  isBidiControl,
  isBidiEmbedding,
  isBidiIsolate,
  isBidiMark,
  isBidiOverride,
  isBraillePattern,
  isControlCharacter,
  isDefaultIgnorable,
  isEmojiBase,
  isEmojiModifier,
  isEmojiVariationSelector,
  isFormatCharacter,
  isFullwidthAlphanumeric,
  isFullwidthPunctuation,
  isHangulFiller,
  isHangulJamo,
  isIdeographicVariationSelector,
  isInvisibleOperator,
  isLatinLigature,
  isMark,
  isMathSymbol,
  isMathematicalAlphanumeric,
  isMongolianVariationSelector,
  isNoncharacter,
  isPictographic,
  isPrependedConcatenationMark,
  isPrivateUse,
  isStandardVariationSelector,
  isTagCharacter,
  isTagSpec,
  isUnassigned,
  isUnusualSpace,
  isVariationSelector,
  isZeroWidth,
  scriptPattern,
} from './unicode-data.js';
import { mergeRuns } from './payload.js';

/**
 * @typedef {object} Edit
 * @property {number} index UTF-16 offset of the first affected code unit
 * @property {number} length UTF-16 length of the affected text
 * @property {string} rule rule id
 * @property {string} message human readable description
 * @property {string|null} replacement text to substitute, null if unfixable
 */

/** Longest flag tag sequence worth recognising (region plus subdivision). */
const MAX_TAG_SEQUENCE = 32;

/**
 * Wraps the text as code points with lazily computed per-line facts.
 */
class CharacterView {
  /**
   * @param {string} text
   * @param {string[]|null} allowedScripts null allows every script
   */
  constructor(text, allowedScripts) {
    this.chars = [];
    this.offsets = [];
    let offset = 0;
    for (const char of text) {
      this.chars.push(char);
      this.offsets.push(offset);
      offset += char.length;
    }
    this.allowedScripts = allowedScripts;
    this.lineFacts = new Map();
  }

  /** @returns {number} */
  codePoint(index) {
    const char = this.chars[index];
    return char === undefined ? -1 : char.codePointAt(0);
  }

  /** @returns {string} '' outside the text */
  char(index) {
    return this.chars[index] ?? '';
  }

  /** @returns {boolean} the script is allowed and the char belongs to it */
  inScript(index, script) {
    if (this.allowedScripts && !this.allowedScripts.includes(script)) {
      return false;
    }
    return scriptPattern(script).test(this.char(index));
  }

  /** @returns {boolean} */
  inAnyScript(index, scripts) {
    return scripts.some((script) => this.inScript(index, script));
  }

  /** @returns {[number, number]} code point bounds of the line around index */
  lineBounds(index) {
    let start = index;
    while (start > 0 && !isLineBreak(this.chars[start - 1])) {
      start -= 1;
    }
    let end = index;
    while (end < this.chars.length && !isLineBreak(this.chars[end])) {
      end += 1;
    }
    return [start, end];
  }

  /**
   * @returns {{ rightToLeft: boolean, balanced: boolean }} whether the line
   *   holds right-to-left letters, and whether its bidi controls form
   *   properly nested pairs without overrides
   */
  bidiFacts(index) {
    const [start, end] = this.lineBounds(index);
    if (!this.lineFacts.has(start)) {
      let rightToLeft = false;
      for (let at = start; at < end && !rightToLeft; at += 1) {
        rightToLeft = this.inAnyScript(at, RIGHT_TO_LEFT_SCRIPTS);
      }
      const balanced = isBalanced(this.chars.slice(start, end));
      this.lineFacts.set(start, { rightToLeft, balanced });
    }
    return this.lineFacts.get(start);
  }
}

/** @returns {boolean} */
function isLineBreak(char) {
  return char === '\n' || char === '\r';
}

/**
 * @param {string[]} chars one line
 * @returns {boolean} embeddings and isolates close in order, no overrides
 */
function isBalanced(chars) {
  const stack = [];
  for (const char of chars) {
    const codePoint = char.codePointAt(0);
    if (isBidiOverride(codePoint)) {
      return false;
    }
    if (isBidiEmbedding(codePoint)) {
      stack.push(BIDI_POP_FORMATTING);
    } else if (isBidiIsolate(codePoint)) {
      stack.push(BIDI_POP_ISOLATE);
    } else if (
      codePoint === BIDI_POP_FORMATTING ||
      codePoint === BIDI_POP_ISOLATE
    ) {
      if (stack.pop() !== codePoint) {
        return false;
      }
    }
  }
  return stack.length === 0;
}

/** @returns {boolean} the joiner sits inside an emoji ZWJ sequence */
function inEmojiSequence(view, index) {
  const previous = view.char(index - 1);
  const before =
    isPictographic(previous) ||
    isEmojiModifier(previous) ||
    isEmojiVariationSelector(view.codePoint(index - 1)) ||
    view.codePoint(index - 1) === CANCEL_TAG;
  return before && isPictographic(view.char(index + 1));
}

/** @returns {boolean} the joiner sits between letters of a joining script */
function inJoiningScript(view, index) {
  return JOINING_SCRIPTS.some(
    (script) =>
      view.inScript(index - 1, script) && view.inScript(index + 1, script)
  );
}

/** @returns {boolean} the tag belongs to a black-flag subdivision sequence */
function inFlagSequence(view, index) {
  let start = index;
  while (
    index - start < MAX_TAG_SEQUENCE &&
    isTagSpec(view.codePoint(start - 1))
  ) {
    start -= 1;
  }
  if (view.codePoint(start - 1) !== BLACK_FLAG) {
    return false;
  }
  let end = index;
  while (end - start < MAX_TAG_SEQUENCE && isTagSpec(view.codePoint(end))) {
    end += 1;
  }
  return view.codePoint(end) === CANCEL_TAG && end > start;
}

const KEYCAP_BASE = /^[0-9#*]$/;
const COMBINING_ENCLOSING_KEYCAP = 0x20e3;

/** @returns {boolean} the selector picks a real variant of its base */
function isMeaningfulSelector(view, index) {
  const codePoint = view.codePoint(index);
  if (
    isVariationSelector(view.codePoint(index - 1)) ||
    isVariationSelector(view.codePoint(index + 1))
  ) {
    return false;
  }
  const base = view.char(index - 1);
  if (isEmojiVariationSelector(codePoint)) {
    if (KEYCAP_BASE.test(base)) {
      return view.codePoint(index + 1) === COMBINING_ENCLOSING_KEYCAP;
    }
    return isEmojiBase(base);
  }
  if (isStandardVariationSelector(codePoint)) {
    return (
      isMathSymbol(base) ||
      view.inAnyScript(index - 1, STANDARD_VARIATION_SCRIPTS)
    );
  }
  if (isIdeographicVariationSelector(codePoint)) {
    return view.inScript(index - 1, 'Han');
  }
  return (
    isMongolianVariationSelector(codePoint) &&
    view.inScript(index - 1, 'Mongolian')
  );
}

/** @returns {boolean} a bidi control that right-to-left text relies on */
function isMeaningfulBidi(view, index) {
  const codePoint = view.codePoint(index);
  if (isBidiOverride(codePoint)) {
    return false;
  }
  const { rightToLeft, balanced } = view.bidiFacts(index);
  if (isBidiMark(codePoint)) {
    return rightToLeft;
  }
  return rightToLeft && balanced;
}

/** @returns {boolean} the code point is next to a CJK character */
function nextToCjk(view, start, end) {
  const isCjk = (at) =>
    view.inAnyScript(at, CJK_SCRIPTS) ||
    (view.codePoint(at) > IDEOGRAPHIC_SPACE && view.codePoint(at) <= 0x303f);
  return isCjk(start - 1) || isCjk(end);
}

/** @returns {[number, number]} the run of fullwidth forms around index */
function fullwidthRun(view, index) {
  const isFullwidth = (at) =>
    isFullwidthAlphanumeric(view.codePoint(at)) ||
    isFullwidthPunctuation(view.codePoint(at));
  let start = index;
  while (isFullwidth(start - 1)) {
    start -= 1;
  }
  let end = index + 1;
  while (isFullwidth(end)) {
    end += 1;
  }
  return [start, end];
}

/** @returns {boolean} an invisible format character with a visible job */
function isMeaningfulFormat(view, index) {
  const codePoint = view.codePoint(index);
  if (codePoint === COMBINING_GRAPHEME_JOINER) {
    return isMark(view.char(index + 1));
  }
  if (isHangulFiller(codePoint)) {
    return (
      codePoint <= 0x1160 &&
      (isHangulJamo(view.codePoint(index - 1)) ||
        isHangulJamo(view.codePoint(index + 1)))
    );
  }
  if (isPrependedConcatenationMark(codePoint)) {
    return /^[\p{Nd}\p{L}\p{M}]$/u.test(view.char(index + 1));
  }
  const layout = SCRIPT_LAYOUT_CONTROLS.find(({ test }) => test(codePoint));
  if (!layout) {
    return false;
  }
  if (layout.musical) {
    const musical = (at) =>
      view.codePoint(at) >= 0x1d100 && view.codePoint(at) <= 0x1d1ff;
    return musical(index - 1) || musical(index + 1);
  }
  return (
    view.inScript(index - 1, layout.script) ||
    view.inScript(index + 1, layout.script)
  );
}

/**
 * Classifiers return a finding, KEEP for a character that is fine where it
 * is, or undefined when the character is not theirs to judge.
 *
 * @typedef {{ rule: string, replacement: string } | typeof KEEP | undefined} Verdict
 */
const KEEP = null;

/**
 * @param {boolean} kept
 * @param {string} rule
 * @param {string} [replacement]
 * @returns {Verdict}
 */
const verdict = (kept, rule, replacement = '') =>
  kept ? KEEP : { rule, replacement };

/** @returns {Verdict} */
function classifyInvisible(view, index) {
  const codePoint = view.codePoint(index);
  if (isTagCharacter(codePoint)) {
    return verdict(inFlagSequence(view, index), 'tag-character');
  }
  if (isVariationSelector(codePoint)) {
    return verdict(isMeaningfulSelector(view, index), 'variation-selector');
  }
  if (isZeroWidth(codePoint)) {
    const joiner =
      codePoint === ZERO_WIDTH_JOINER || codePoint === ZERO_WIDTH_NON_JOINER;
    const kept =
      joiner &&
      (inJoiningScript(view, index) ||
        (codePoint === ZERO_WIDTH_JOINER && inEmojiSequence(view, index)));
    return verdict(kept, 'zero-width');
  }
  if (isBidiControl(codePoint)) {
    return verdict(isMeaningfulBidi(view, index), 'bidi-control');
  }
  if (isInvisibleOperator(codePoint) || codePoint === OBJECT_REPLACEMENT) {
    return verdict(false, 'invisible-format');
  }
  if (codePoint === BRAILLE_BLANK) {
    const braille =
      isBraillePattern(view.codePoint(index - 1)) ||
      isBraillePattern(view.codePoint(index + 1));
    return verdict(braille, 'invisible-format');
  }
  return undefined;
}

/** @returns {Verdict} */
function classifyVisible(view, index) {
  const codePoint = view.codePoint(index);
  const char = view.char(index);
  if (isUnusualSpace(codePoint)) {
    const cjkSpace =
      codePoint === IDEOGRAPHIC_SPACE && nextToCjk(view, index, index + 1);
    const mongolianSpace =
      codePoint === NARROW_NO_BREAK_SPACE &&
      (view.inScript(index - 1, 'Mongolian') ||
        view.inScript(index + 1, 'Mongolian'));
    return verdict(cjkSpace || mongolianSpace, 'unusual-space', ' ');
  }
  if (LINE_SEPARATORS.has(codePoint)) {
    return { rule: 'line-separator', replacement: '\n' };
  }
  if (isControlCharacter(codePoint)) {
    return { rule: 'control-character', replacement: '' };
  }
  if (isFullwidthAlphanumeric(codePoint) || isFullwidthPunctuation(codePoint)) {
    const [start, end] = fullwidthRun(view, index);
    return verdict(
      nextToCjk(view, start, end),
      'compatibility-character',
      char.normalize('NFKC')
    );
  }
  if (isMathematicalAlphanumeric(codePoint) || isLatinLigature(codePoint)) {
    return {
      rule: 'compatibility-character',
      replacement: char.normalize('NFKC'),
    };
  }
  if (codePoint === REPLACEMENT_CHARACTER) {
    return { rule: 'replacement-character', replacement: null };
  }
  if (TYPOGRAPHIC_REPLACEMENTS.has(codePoint)) {
    return {
      rule: 'typographic-punctuation',
      replacement: TYPOGRAPHIC_REPLACEMENTS.get(codePoint),
    };
  }
  return undefined;
}

/** @returns {Verdict} */
function classifyRemaining(view, index) {
  const codePoint = view.codePoint(index);
  const char = view.char(index);
  if (isNoncharacter(codePoint)) {
    return { rule: 'noncharacter', replacement: '' };
  }
  if (isPrivateUse(codePoint)) {
    return { rule: 'private-use', replacement: '' };
  }
  if (isFormatCharacter(char) || isDefaultIgnorable(char)) {
    return verdict(isMeaningfulFormat(view, index), 'invisible-format');
  }
  if (isUnassigned(char)) {
    return { rule: 'unassigned', replacement: '' };
  }
  return undefined;
}

/** Characters that can never need any classification. */
const PLAIN = /^[\t\n\r\x20-\x7e]$/;

/**
 * @param {string} text
 * @param {{ allowedScripts?: string[]|null }} [options]
 * @returns {Edit[]} findings at code point level, in text order, with
 *   runs of removed characters merged into one finding
 */
export function findCharacterIssues(text, { allowedScripts = null } = {}) {
  const view = new CharacterView(text, allowedScripts);
  const edits = [];
  for (let index = 0; index < view.chars.length; index += 1) {
    const char = view.chars[index];
    if (PLAIN.test(char)) {
      continue;
    }
    let found = classifyInvisible(view, index);
    if (found === undefined) {
      found = classifyVisible(view, index);
    }
    if (found === undefined) {
      found = classifyRemaining(view, index);
    }
    if (found) {
      edits.push({
        index: view.offsets[index],
        length: char.length,
        rule: found.rule,
        message: describeCharacter(char),
        replacement: found.replacement,
      });
    }
  }
  return mergeRuns(text, edits);
}
