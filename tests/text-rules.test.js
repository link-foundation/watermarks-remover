/**
 * Every text rule: what it reports, what --fix writes, and what it leaves
 * alone. Fixtures are written with escapes so this file stays ASCII.
 */

import { describe, it, expect } from 'test-anywhere';

import {
  createLocator,
  defaultSeverities,
  fixText,
  scanText,
} from '../src/index.js';

const rulesOf = (text, options) =>
  scanText(text, options).map((edit) => edit.rule);

const withRules = (rules) => ({
  severities: { ...defaultSeverities(), ...rules },
});

/** [name, input, reported rules, fixed text] */
const CASES = [
  ['zero-width space', 'Hello\u{200B}world\n', ['zero-width'], 'Helloworld\n'],
  [
    'zero-width run of a hidden message',
    'a\u{200B}\u{200C}\u{200B}\u{200D}b\n',
    ['zero-width'],
    'ab\n',
  ],
  ['word joiner', 'a\u{2060}b\n', ['zero-width'], 'ab\n'],
  ['byte order mark inside text', 'a\u{FEFF}b\n', ['zero-width'], 'ab\n'],
  [
    'right-to-left override (Trojan Source)',
    'x = 1; // \u{202E} } \u{2066}\n',
    ['bidi-control', 'bidi-control'],
    'x = 1; //  }\n',
  ],
  [
    'tag characters (ASCII smuggling)',
    'hi\u{E0068}\u{E0069}\n',
    ['tag-character'],
    'hi\n',
  ],
  [
    'variation selector run (byte smuggling)',
    'a\u{1F600}\u{FE0F}\u{E0101}\u{E0102}\n',
    ['variation-selector'],
    'a\u{1F600}\n',
  ],
  ['soft hyphen', 'co\u{00AD}operate\n', ['invisible-format'], 'cooperate\n'],
  [
    'invisible operators (Sneaky Bits)',
    'a\u{2062}\u{2064}\u{2062}b\n',
    ['invisible-format'],
    'ab\n',
  ],
  ['Hangul filler', 'a\u{3164}b\n', ['invisible-format'], 'ab\n'],
  ['private use character', 'a\u{E000}b\n', ['private-use'], 'ab\n'],
  ['noncharacter', 'a\u{FDD0}b\n', ['noncharacter'], 'ab\n'],
  ['no-break space', 'a\u{00A0}b\n', ['unusual-space'], 'a b\n'],
  ['narrow no-break space', 'a\u{202F}b\n', ['unusual-space'], 'a b\n'],
  ['line separator', 'a\u{2028}b\n', ['line-separator'], 'a\nb\n'],
  ['control character', 'a\u{0007}b\n', ['control-character'], 'ab\n'],
  [
    'fullwidth Latin',
    '\u{FF21}\u{FF22}\n',
    ['compatibility-character', 'compatibility-character'],
    'AB\n',
  ],
  [
    'mathematical bold letters',
    '\u{1D400}\n',
    ['compatibility-character'],
    'A\n',
  ],
  [
    'Cyrillic look-alike in a Latin word',
    'p\u{0430}ypal\n',
    ['confusable'],
    'paypal\n',
  ],
  [
    'combining mark stack (Zalgo)',
    `a${'\u{0301}'.repeat(10)}\n`,
    ['unicode-normalization', 'combining-marks'],
    `\u{00E1}${'\u{0301}'.repeat(5)}\n`,
  ],
  ['decomposed accent', 'e\u{0301}\n', ['unicode-normalization'], '\u{00E9}\n'],
  [
    'ChatGPT citation marker',
    'See \u{E200}cite\u{E202}turn0search3\u{E201} here\n',
    ['ai-artifact'],
    'See  here\n',
  ],
  [
    'ChatGPT tracking parameter',
    'https://x.io/a?utm_source=chatgpt.com\n',
    ['ai-artifact'],
    'https://x.io/a\n',
  ],
  [
    'ChatGPT tracking parameter among others',
    'https://x.io/a?utm_source=chatgpt.com&b=1\n',
    ['ai-artifact'],
    'https://x.io/a?b=1\n',
  ],
  [
    'Assistants API source citation',
    'Fact\u{3010}4:0\u{2020}source\u{3011}.\n',
    ['ai-artifact'],
    'Fact.\n',
  ],
  [
    'trailing spaces',
    'a  \nb\t\n',
    ['trailing-whitespace', 'trailing-whitespace'],
    'a\nb\n',
  ],
  ['CRLF line endings', 'a\r\nb\r\n', ['line-endings'], 'a\nb\n'],
  ['missing final newline', 'a', ['final-newline'], 'a\n'],
  ['trailing blank lines', 'a\n\n\n', ['final-newline'], 'a\n'],
  ['mojibake', 'Caf\u{00C3}\u{00A9}\n', ['mojibake'], 'Caf\u{00E9}\n'],
];

/** [name, text] that must not be reported */
const CLEAN = [
  ['plain ASCII', 'Hello, world!\n'],
  ['emoji ZWJ sequence', 'Dev \u{1F468}\u{200D}\u{1F4BB}\n'],
  ['emoji presentation selector', 'ok \u{2764}\u{FE0F}\n'],
  ['emoji keycap', '1\u{FE0F}\u{20E3}\n'],
  [
    'emoji tag flag',
    '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}\n',
  ],
  ['skin tone modifier', '\u{1F44D}\u{1F3FD}\n'],
  [
    'Persian zero-width non-joiner',
    '\u{0645}\u{06CC}\u{200C}\u{062E}\u{0648}\u{0627}\u{0647}\u{0645}\n',
  ],
  [
    'Hebrew right-to-left mark',
    '\u{05E9}\u{05DC}\u{05D5}\u{05DD} \u{200F}(1)\n',
  ],
  ['French accents', 'Fran\u{00E7}ais \u{00C0} la carte, \u{00C2}ge\n'],
  ['Russian text', '\u{041F}\u{0440}\u{0438}\u{0432}\u{0435}\u{0442}\n'],
  ['Greek text', '\u{03B1}\u{03B2}\u{03B3}\n'],
  [
    'CJK with fullwidth digits',
    '\u{65E5}\u{672C}\u{FF12}\u{FF10}\u{FF12}\u{FF14}\u{5E74}\n',
  ],
  ['Markdown hard break', 'line  \nnext\n'],
  ['tabs inside a line', 'a\tb\n'],
  ['empty text', ''],
];

describe('text rules', () => {
  for (const [name, input, rules, fixed] of CASES) {
    it(`reports and fixes ${name}`, () => {
      expect(rulesOf(input, { markdown: false })).toEqual(rules);
      expect(fixText(input, { markdown: false })).toBe(fixed);
    });

    it(`leaves nothing fixable after fixing ${name}`, () => {
      const once = fixText(input);
      expect(
        scanText(once).filter((edit) => edit.replacement !== null)
      ).toEqual([]);
      expect(fixText(once)).toBe(once);
    });
  }

  for (const [name, text] of CLEAN) {
    it(`keeps ${name}`, () => {
      expect(scanText(text, { markdown: true })).toEqual([]);
      expect(fixText(text, { markdown: true })).toBe(text);
    });
  }
});

describe('rule options', () => {
  it('reports trailing double spaces outside Markdown', () => {
    expect(rulesOf('line  \nnext\n', { markdown: false })).toEqual([
      'trailing-whitespace',
    ]);
  });

  it('turns rules off', () => {
    const options = withRules({ 'zero-width': 'off' });
    expect(scanText('a\u{200B}b\n', options)).toEqual([]);
    expect(fixText('a\u{200B}b\n', options)).toBe('a\u{200B}b\n');
  });

  it('writes CRLF when configured', () => {
    expect(fixText('a\nb\n', { lineEndings: 'crlf' })).toBe('a\r\nb\r\n');
    expect(rulesOf('a\r\nb\r\n', { lineEndings: 'crlf' })).toEqual([]);
  });

  it('keeps mixed line endings when configured', () => {
    expect(rulesOf('a\r\nb\n', { lineEndings: 'keep' })).toEqual([]);
  });

  it('reports letters outside the allowed scripts', () => {
    const options = { allowedScripts: ['Latin'] };
    expect(rulesOf('Hello \u{041F}\u{0440}\u{0438}\n', options)).toEqual([
      'unexpected-script',
    ]);
    expect(rulesOf('Hello\n', options)).toEqual([]);
  });

  it('rewrites typographic punctuation when enabled', () => {
    const options = withRules({ 'typographic-punctuation': 'error' });
    expect(
      fixText('\u{201C}Hi\u{201D} \u{2014} it\u{2019}s\u{2026}\n', options)
    ).toBe('"Hi" - it\'s...\n');
  });

  it('honours the combining mark limit', () => {
    const text = `a${'\u{0301}'.repeat(3)}\n`;
    expect(rulesOf(text, { combiningMarkLimit: 2 })).toContain(
      'combining-marks'
    );
    expect(rulesOf(text)).not.toContain('combining-marks');
  });

  it('reports a character covered by an earlier rule only once', () => {
    expect(rulesOf('\u{E200}cite\u{E202}turn0search3\u{E201}\n')).toEqual([
      'ai-artifact',
    ]);
  });
});

describe('createLocator', () => {
  it('maps offsets to lines and code point columns', () => {
    const text = 'ab\n\u{1F600}c\r\nd';
    const locate = createLocator(text);
    expect(locate(0)).toEqual({ line: 1, column: 1 });
    expect(locate(3)).toEqual({ line: 2, column: 1 });
    expect(locate(5)).toEqual({ line: 2, column: 2 });
    expect(locate(text.indexOf('d'))).toEqual({ line: 3, column: 1 });
  });
});
