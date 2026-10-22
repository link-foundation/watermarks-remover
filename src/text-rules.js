/**
 * Text level checks and fixes. `scanText` reports every problem against the
 * original text; `fixText` applies the enabled fixes in a fixed order and
 * repeats until the result is stable, so fixing is idempotent.
 */

import { findCharacterIssues } from './characters.js';
import { findConfusableWords } from './confusables.js';
import {
  findArtifacts,
  findEscapedCarriers,
  findMojibake,
  findProvenanceManifests,
} from './patterns.js';
import { defaultSeverities } from './rules.js';
import { scriptPattern } from './unicode-data.js';

/**
 * @typedef {import('./characters.js').Edit} Edit
 * @typedef {import('./rules.js').Severity} Severity
 *
 * @typedef {object} TextOptions
 * @property {Record<string, Severity>} [severities] defaults to the rule
 *   defaults
 * @property {string[]|null} [allowedScripts] null allows every script
 * @property {'lf'|'crlf'|'keep'} [lineEndings]
 * @property {number} [combiningMarkLimit]
 * @property {boolean} [markdown] keep two-space hard line breaks
 */

export const DEFAULT_COMBINING_MARK_LIMIT = 6;

/**
 * @param {string} text
 * @param {number} limit
 * @returns {Edit[]}
 */
function findCombiningStacks(text, limit) {
  const pattern = new RegExp(`\\p{M}{${limit + 1},}`, 'gu');
  return [...text.matchAll(pattern)].map((match) => {
    const kept = [...match[0]].slice(0, limit).join('');
    return {
      index: match.index,
      length: match[0].length,
      rule: 'combining-marks',
      message: `${[...match[0]].length} combining marks on one character, limit is ${limit}`,
      replacement: kept,
    };
  });
}

/** @returns {Edit[]} */
function findConfusables(text) {
  return findConfusableWords(text).map(({ index, original, replacement }) => ({
    index,
    length: original.length,
    rule: 'confusable',
    message: `"${original}" mixes look-alike letters from different scripts, reads as "${replacement}"`,
    replacement,
  }));
}

const IGNORED_SCRIPTS = ['Common', 'Inherited'];
const LETTER_RUN = /\p{L}+/gu;

/**
 * @param {string} text
 * @param {string[]} allowedScripts
 * @returns {Edit[]} unfixable findings for letters of other scripts
 */
function findUnexpectedScripts(text, allowedScripts) {
  const scripts = [...allowedScripts, ...IGNORED_SCRIPTS].map(scriptPattern);
  const edits = [];
  for (const match of text.matchAll(LETTER_RUN)) {
    const foreign = [...match[0]].find(
      (letter) => !scripts.some((pattern) => pattern.test(letter))
    );
    if (foreign) {
      edits.push({
        index: match.index,
        length: match[0].length,
        rule: 'unexpected-script',
        message: `"${match[0]}" uses a script outside allowed-scripts`,
        replacement: null,
      });
    }
  }
  return edits;
}

/** @returns {Edit[]} */
function findDenormalized(text) {
  const normalized = text.normalize('NFC');
  if (normalized === text) {
    return [];
  }
  let index = 0;
  while (text[index] === normalized[index]) {
    index += 1;
  }
  return [
    {
      index,
      length: 0,
      rule: 'unicode-normalization',
      message: 'text is not in Unicode Normalization Form C (NFC)',
      replacement: null,
      fix: () => normalized,
    },
  ];
}

const TRAILING_WHITESPACE = /[ \t]+(?=\r?\n|\r|$)/g;

/** @returns {boolean} two spaces ending a non-blank Markdown line */
const isHardBreak = (text, match) =>
  match[0] === '  ' &&
  /\S/.test(text[match.index - 1] ?? '') &&
  match.index + 2 < text.length;

/** @returns {Edit[]} */
function findTrailingWhitespace(text, { markdown = false }) {
  const edits = [];
  for (const match of text.matchAll(TRAILING_WHITESPACE)) {
    if (markdown && isHardBreak(text, match)) {
      continue;
    }
    edits.push({
      index: match.index,
      length: match[0].length,
      rule: 'trailing-whitespace',
      message: `${match[0].length} trailing whitespace character(s)`,
      replacement: '',
    });
  }
  return edits;
}

const LINE_BREAK = /\r\n|\r|\n/g;
const LINE_ENDING_NAMES = { '\r\n': 'CRLF', '\r': 'CR', '\n': 'LF' };

/** @returns {Edit[]} one finding for the first line ending of the wrong kind */
function findLineEndings(text, { lineEndings = 'lf' }) {
  if (lineEndings === 'keep') {
    return [];
  }
  const expected = lineEndings === 'crlf' ? '\r\n' : '\n';
  const wrong = [...text.matchAll(LINE_BREAK)].filter(
    (match) => match[0] !== expected
  );
  if (wrong.length === 0) {
    return [];
  }
  const kinds = [...new Set(wrong.map((match) => match[0]))]
    .map((kind) => LINE_ENDING_NAMES[kind])
    .join(', ');
  return [
    {
      index: wrong[0].index,
      length: 0,
      rule: 'line-endings',
      message: `${wrong.length} line ending(s) are ${kinds}, expected ${LINE_ENDING_NAMES[expected]}`,
      replacement: null,
      fix: (current) => current.replace(LINE_BREAK, expected),
    },
  ];
}

/** A lone `\r` never matches the first half of a `\r\n`. */
const TRAILING_BLANK_LINES =
  /(?:\r\n|\r(?!\n)|\n)(?:[ \t]*(?:\r\n|\r(?!\n)|\n))+$/;
const TRAILING_BREAKS = /(?:\r\n|\r(?!\n)|\n)(?:[ \t]*(?:\r\n|\r(?!\n)|\n))*$/;

/** @returns {Edit[]} */
function findFinalNewline(text, { lineEndings = 'lf' }) {
  if (text.length === 0) {
    return [];
  }
  const blank = TRAILING_BLANK_LINES.exec(text);
  if (!blank && /[\r\n]$/.test(text)) {
    return [];
  }
  const newline = (current) => {
    if (lineEndings === 'crlf') {
      return '\r\n';
    }
    return lineEndings === 'keep'
      ? (/\r\n|\r|\n/.exec(current)?.[0] ?? '\n')
      : '\n';
  };
  return [
    {
      index: blank ? blank.index : text.length,
      length: 0,
      rule: 'final-newline',
      message: blank
        ? 'trailing blank lines at end of file'
        : 'missing newline at end of file',
      replacement: null,
      fix: (current) => current.replace(TRAILING_BREAKS, '') + newline(current),
    },
  ];
}

/**
 * Every detector in fix order. Edits that carry a `fix` rewrite the whole
 * text; the rest are local replacements.
 *
 * @type {Array<[string[], (text: string, options: TextOptions) => Edit[]]>}
 */
const DETECTORS = [
  [['provenance-manifest'], (text) => findProvenanceManifests(text)],
  [['ai-artifact'], (text) => findArtifacts(text)],
  [['mojibake'], (text) => findMojibake(text)],
  [
    [
      'zero-width',
      'bidi-control',
      'tag-character',
      'variation-selector',
      'invisible-format',
      'private-use',
      'noncharacter',
      'unassigned',
      'replacement-character',
      'unusual-space',
      'line-separator',
      'control-character',
      'compatibility-character',
      'typographic-punctuation',
    ],
    (text, options) =>
      findCharacterIssues(text, { allowedScripts: options.allowedScripts }),
  ],
  [['confusable'], (text) => findConfusables(text)],
  [
    ['combining-marks'],
    (text, options) =>
      findCombiningStacks(
        text,
        options.combiningMarkLimit ?? DEFAULT_COMBINING_MARK_LIMIT
      ),
  ],
  [['unicode-normalization'], (text) => findDenormalized(text)],
  [
    ['unexpected-script'],
    (text, options) =>
      options.allowedScripts
        ? findUnexpectedScripts(text, options.allowedScripts)
        : [],
  ],
  [['trailing-whitespace'], findTrailingWhitespace],
  [['line-endings'], findLineEndings],
  [['final-newline'], findFinalNewline],
  [['escaped-character'], (text) => findEscapedCarriers(text)],
];

/** @returns {boolean} */
const DEFAULT_SEVERITIES = defaultSeverities();

const isEnabled = (options, rule) =>
  ((options.severities ?? DEFAULT_SEVERITIES)[rule] ?? 'off') !== 'off';

/**
 * @param {Edit[]} edits
 * @param {Edit[]} covering edits of earlier detectors
 * @returns {Edit[]} the edits not inside one of the covering edits, so a
 *   citation marker is not also reported as private-use characters
 */
const uncovered = (edits, covering) =>
  edits.filter(
    (edit) =>
      !covering.some(
        (cover) =>
          cover.length > 0 &&
          cover.index <= edit.index &&
          edit.index + edit.length <= cover.index + cover.length
      )
  );

/**
 * @param {string} text
 * @param {TextOptions} [options]
 * @returns {Edit[]} findings of enabled rules, in text order
 */
export function scanText(text, options = {}) {
  const edits = [];
  for (const [rules, detect] of DETECTORS) {
    if (rules.some((rule) => isEnabled(options, rule))) {
      const found = detect(text, options).filter((edit) =>
        isEnabled(options, edit.rule)
      );
      edits.push(...uncovered(found, edits));
    }
  }
  return edits.sort((left, right) => left.index - right.index);
}

/**
 * @param {string} text
 * @param {Edit[]} edits non-overlapping local edits
 * @returns {string}
 */
function applyLocalEdits(text, edits) {
  let result = '';
  let cursor = 0;
  for (const edit of [...edits].sort((a, b) => a.index - b.index)) {
    if (edit.index < cursor || edit.replacement === null) {
      continue;
    }
    result += text.slice(cursor, edit.index) + edit.replacement;
    cursor = edit.index + edit.length;
  }
  return result + text.slice(cursor);
}

/**
 * @param {string} text
 * @param {TextOptions} options
 * @returns {string} the text after one round of every enabled fix
 */
function fixOnce(text, options) {
  let current = text;
  for (const [rules, detect] of DETECTORS) {
    if (!rules.some((rule) => isEnabled(options, rule))) {
      continue;
    }
    const edits = detect(current, options).filter((edit) =>
      isEnabled(options, edit.rule)
    );
    current = applyLocalEdits(current, edits);
    for (const edit of edits) {
      if (edit.fix) {
        current = edit.fix(current);
      }
    }
  }
  return current;
}

/** Fixing can expose new problems, for example joining two words. */
const MAX_FIX_ROUNDS = 5;

/**
 * @param {string} text
 * @param {TextOptions} [options]
 * @returns {string} the repaired text
 */
export function fixText(text, options = {}) {
  let current = text;
  for (let round = 0; round < MAX_FIX_ROUNDS; round += 1) {
    const next = fixOnce(current, options);
    if (next === current) {
      break;
    }
    current = next;
  }
  return current;
}

/**
 * @param {string} text
 * @returns {(index: number) => { line: number, column: number }} maps a
 *   UTF-16 offset to a 1-based line and a 1-based column in code points
 */
export function createLocator(text) {
  const starts = [0];
  for (const match of text.matchAll(LINE_BREAK)) {
    starts.push(match.index + match[0].length);
  }
  return (index) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (starts[middle] <= index) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    const column = [...text.slice(starts[low], index)].length + 1;
    return { line: low + 1, column };
  };
}
