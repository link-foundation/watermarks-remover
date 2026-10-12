/**
 * Pattern based detectors: leftovers of chatbot answers, C2PA text
 * manifests, invisible characters written as escapes, and mojibake.
 */

import {
  isBidiControl,
  isDefaultIgnorable,
  isNoncharacter,
  isPrivateUse,
  isTagCharacter,
  formatCodePoint,
} from './unicode-data.js';

import { singleByteTable } from './encoding.js';

/** @typedef {import('./characters.js').Edit} Edit */

const remove = () => '';

/** Leftovers of chatbot answers pasted into documents. */
const AI_ARTIFACTS = [
  {
    pattern:
      /\u{E200}?cite(?:\u{E202}?turn\d+(?:search|news|view|fetch|file|image|academia|product)\d+)+\u{E201}?/gu,
    message: 'ChatGPT citation marker',
    replacement: remove,
  },
  {
    pattern: /\u{E200}[^\u{E201}\n]{0,200}\u{E201}/gu,
    message: 'ChatGPT entity marker',
    replacement: remove,
  },
  {
    pattern: /\u{3010}\d+(?::\d+)?\u{2020}[^\u{3011}\n]{0,100}\u{3011}/gu,
    message: 'OpenAI file citation marker',
    replacement: remove,
  },
  {
    pattern: /:?contentReference\[oaicite:\d+\](?:\{index=\d+\})?/gu,
    message: 'ChatGPT contentReference marker',
    replacement: remove,
  },
  {
    pattern: / data-(?:start|end|is-last-node|is-only-node)(?:="\d*")?/gu,
    message: 'ChatGPT HTML position attribute',
    replacement: remove,
  },
  {
    pattern:
      /([?&])utm_source=(?:chatgpt\.com|openai|perplexity(?:\.ai)?|copilot\.com|gemini|claude\.ai)(&?)/gu,
    message: 'chatbot tracking parameter',
    replacement: (match, separator, following) =>
      separator === '?' && following ? '?' : '',
  },
];

/**
 * C2PA 2.3+ structured text manifests (Appendix A.9): one armoured block
 * in a comment, removed together with the lines that hold it.
 */
const C2PA_BLOCK =
  /^[^\n]*-{5}BEGIN C2PA MANIFEST-{5}[\s\S]*?-{5}END C2PA MANIFEST-{5}[^\n]*(?:\r?\n|$)/gmu;

/**
 * C2PA unstructured text manifests (Appendix A.8): U+FEFF followed by the
 * manifest bytes written as variation selectors.
 */
const C2PA_WRAPPER = /\u{FEFF}[\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}]{8,}/gu;
const C2PA_MAGIC = 'C2PATXT\0';

/**
 * @param {string} run variation selectors
 * @returns {string} the bytes they carry, read as Latin-1
 */
function selectorBytes(run) {
  return [...run]
    .map((char) => {
      const codePoint = char.codePointAt(0);
      return codePoint < 0xe0100 ? codePoint - 0xfe00 : codePoint - 0xe00f0;
    })
    .map((byte) => String.fromCharCode(byte))
    .join('');
}

/**
 * @param {string} text
 * @param {Array<{pattern: RegExp, message: string, replacement: Function}>} patterns
 * @param {string} rule
 * @returns {Edit[]} matches of earlier patterns win over overlapping ones
 */
function matchPatterns(text, patterns, rule) {
  const edits = [];
  for (const { pattern, message, replacement } of patterns) {
    for (const match of text.matchAll(pattern)) {
      const end = match.index + match[0].length;
      if (
        edits.some(
          (edit) => edit.index < end && match.index < edit.index + edit.length
        )
      ) {
        continue;
      }
      edits.push({
        index: match.index,
        length: match[0].length,
        rule,
        message: `${message} ${JSON.stringify(match[0])}`,
        replacement: replacement(...match),
      });
    }
  }
  return edits;
}

/**
 * @param {string} text
 * @returns {Edit[]}
 */
export const findArtifacts = (text) =>
  matchPatterns(text, AI_ARTIFACTS, 'ai-artifact');

/**
 * @param {string} text
 * @returns {Edit[]}
 */
export function findProvenanceManifests(text) {
  const edits = [];
  for (const match of text.matchAll(C2PA_BLOCK)) {
    edits.push({
      index: match.index,
      length: match[0].length,
      rule: 'provenance-manifest',
      message: 'C2PA structured text manifest block',
      replacement: '',
    });
  }
  for (const match of text.matchAll(C2PA_WRAPPER)) {
    const magic = selectorBytes(match[0].slice(1)).startsWith(C2PA_MAGIC);
    edits.push({
      index: match.index,
      length: match[0].length,
      rule: 'provenance-manifest',
      message: magic
        ? 'C2PA unstructured text manifest (U+FEFF and variation selectors)'
        : 'U+FEFF followed by a run of variation selectors (C2PA style wrapper)',
      replacement: '',
    });
  }
  return edits;
}

/** Named HTML entities that stand for invisible characters. */
const INVISIBLE_ENTITIES = new Map([
  ['shy', 0xad],
  ['ZeroWidthSpace', 0x200b],
  ['NegativeVeryThinSpace', 0x200b],
  ['NegativeThinSpace', 0x200b],
  ['NegativeMediumSpace', 0x200b],
  ['NegativeThickSpace', 0x200b],
  ['zwnj', 0x200c],
  ['zwj', 0x200d],
  ['lrm', 0x200e],
  ['rlm', 0x200f],
  ['NoBreak', 0x2060],
  ['af', 0x2061],
  ['ApplyFunction', 0x2061],
  ['it', 0x2062],
  ['InvisibleTimes', 0x2062],
  ['ic', 0x2063],
  ['InvisibleComma', 0x2063],
]);

const hex = (digits) => Number.parseInt(digits, 16);

/** Escape syntaxes of programming languages, HTML, CSS and URLs. */
const ESCAPES = [
  {
    pattern: /\\u(d[89ab][0-9a-f]{2})\\u(d[c-f][0-9a-f]{2})/giu,
    decode: (high, low) =>
      (hex(high) - 0xd800) * 0x400 + hex(low) - 0xdc00 + 0x10000,
  },
  { pattern: /\\u\{([0-9a-f]{1,6})\}/giu, decode: hex },
  { pattern: /\\u([0-9a-f]{4})/giu, decode: hex },
  { pattern: /\\U([0-9a-fA-F]{8})/gu, decode: hex },
  { pattern: /\\x\{([0-9a-f]{1,6})\}/giu, decode: hex },
  { pattern: /&#x([0-9a-f]{1,6});?/giu, decode: hex },
  { pattern: /&#(\d{1,7});?/gu, decode: (digits) => Number(digits) },
  {
    pattern: /&([A-Za-z]+);/gu,
    decode: (name) => INVISIBLE_ENTITIES.get(name) ?? null,
  },
  {
    pattern: /%([0-9a-f]{2})%([0-9a-f]{2})%([0-9a-f]{2})(?:%([0-9a-f]{2}))?/giu,
    decode: (...bytes) => {
      const decoded = new TextDecoder().decode(
        Uint8Array.from(bytes.filter(Boolean).map(hex))
      );
      return [...decoded].length === 1 ? decoded.codePointAt(0) : null;
    },
  },
];

/**
 * @param {number|null} codePoint
 * @returns {boolean} whether an escape for it hides an invisible carrier
 */
function isHiddenCarrier(codePoint) {
  if (codePoint === null || codePoint > 0x10ffff || codePoint === 0xfeff) {
    return false;
  }
  return (
    isBidiControl(codePoint) ||
    isTagCharacter(codePoint) ||
    isNoncharacter(codePoint) ||
    isPrivateUse(codePoint) ||
    isDefaultIgnorable(String.fromCodePoint(codePoint))
  );
}

/**
 * Escapes are reported but never rewritten: a test fixture may need them,
 * and their meaning depends on the language.
 *
 * @param {string} text
 * @returns {Edit[]}
 */
export function findEscapedCarriers(text) {
  const edits = [];
  const covered = new Set();
  for (const { pattern, decode } of ESCAPES) {
    for (const match of text.matchAll(pattern)) {
      const codePoint = decode(...match.slice(1));
      if (!covered.has(match.index) && isHiddenCarrier(codePoint)) {
        covered.add(match.index);
        edits.push({
          index: match.index,
          length: match[0].length,
          rule: 'escaped-character',
          message: `escape "${match[0]}" writes the invisible ${formatCodePoint(String.fromCodePoint(codePoint))}`,
          replacement: null,
        });
      }
    }
  }
  return edits;
}

/**
 * Text that was UTF-8, wrongly decoded as Windows-1252 and saved again:
 * U+00C3 U+00A9 for U+00E9, U+00E2 U+20AC U+2122 for U+2019. A lead byte
 * between C2 and F4 is followed by one to three bytes from 80 to BF, which
 * Windows-1252 shows as C1 controls, Latin-1 symbols or the letters and
 * punctuation of 80 to 9F. Every candidate is verified by re-encoding it
 * and decoding the bytes as strict UTF-8.
 */
const MOJIBAKE =
  /[\u{C2}-\u{F4}][\u0080-\u{BF}\u{152}\u{153}\u{160}\u{161}\u{178}\u{17D}\u{17E}\u{192}\u{2C6}\u{2DC}\u{2013}\u{2014}\u{2018}-\u{201A}\u{201C}-\u{201E}\u{2020}-\u{2022}\u{2026}\u{2030}\u{2039}\u{203A}\u{20AC}\u{2122}]{1,3}/gu;

/**
 * @param {string} candidate
 * @returns {string|null} the repaired text, null if it is not mojibake
 */
function repairMojibake(candidate) {
  const table = singleByteTable('windows-1252');
  const bytes = [...candidate].map((char) => table.get(char));
  if (bytes.some((byte) => byte === undefined)) {
    return null;
  }
  try {
    const repaired = new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(bytes)
    );
    return [...repaired].length === 1 ? repaired : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} text
 * @returns {Edit[]}
 */
export function findMojibake(text) {
  const edits = [];
  for (const match of text.matchAll(MOJIBAKE)) {
    const chars = [...match[0]];
    for (let length = chars.length; length >= 2; length -= 1) {
      const candidate = chars.slice(0, length).join('');
      const repaired = repairMojibake(candidate);
      if (repaired) {
        edits.push({
          index: match.index,
          length: candidate.length,
          rule: 'mojibake',
          message: `${JSON.stringify(candidate)} is UTF-8 decoded as Windows-1252, reads as ${JSON.stringify(repaired)}`,
          replacement: repaired,
        });
        break;
      }
    }
  }
  return edits;
}
