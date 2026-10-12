/**
 * The Links Notation configuration and the glob patterns it uses.
 */

import { describe, it, expect } from 'test-anywhere';

import {
  ConfigError,
  STARTER_CONFIG,
  defaultConfig,
  isIncluded,
  matchesGlob,
  parseConfig,
  settingsFor,
} from '../src/index.js';

/**
 * @param {string} source
 * @returns {Error|null} the error parseConfig throws
 */
function configError(source) {
  try {
    parseConfig(source);
    return null;
  } catch (error) {
    return error;
  }
}

describe('parseConfig', () => {
  it('returns the defaults for an empty file', () => {
    expect(parseConfig('')).toEqual(defaultConfig());
  });

  it('reads the starter configuration as the defaults', () => {
    const config = parseConfig(STARTER_CONFIG);
    const defaults = defaultConfig();
    expect(config.encoding).toBe(defaults.encoding);
    expect(config.bom).toBe(defaults.bom);
    expect(config.lineEndings).toBe(defaults.lineEndings);
    expect(config.maxFileSize).toBe(defaults.maxFileSize);
    expect(config.allowedScripts).toBeNull();
    expect(config.rules).toEqual(defaults.rules);
    expect(config.overrides).toEqual([
      { patterns: ['*.bat', '*.cmd'], settings: { lineEndings: 'crlf' } },
    ]);
  });

  it('reads every scalar setting', () => {
    const config = parseConfig(
      [
        'encoding: keep',
        'fallback-encoding: latin1',
        'bom: require',
        'line-endings: crlf',
        'allowed-scripts: Latin Cyrillic',
        'combining-mark-limit: 3',
        'markdown-hard-breaks: false',
        'max-file-size: 512kb',
      ].join('\n')
    );
    expect(config.encoding).toBe('keep');
    expect(config.fallbackEncoding).toBe('windows-1252');
    expect(config.bom).toBe('require');
    expect(config.lineEndings).toBe('crlf');
    expect(config.allowedScripts).toEqual(['Latin', 'Cyrillic']);
    expect(config.combiningMarkLimit).toBe(3);
    expect(config.markdownHardBreaks).toBe(false);
    expect(config.maxFileSize).toBe(512 * 1024);
  });

  it('reads file lists inline and one per line', () => {
    const config = parseConfig(
      [
        '# comments are ignored',
        'files',
        "  include: 'src' 'docs'",
        '  exclude',
        "    'vendor/**'",
        "    '*.min.js'",
      ].join('\n')
    );
    expect(config.include).toEqual(['src', 'docs']);
    expect(config.exclude).toEqual(['vendor/**', '*.min.js']);
  });

  it('reads rule severities and overrides in order', () => {
    const config = parseConfig(
      [
        'rules',
        '  typographic-punctuation: warn',
        '  confusable: off',
        'overrides',
        "  'legacy/**'",
        '    encoding: keep',
        '    rules',
        '      zero-width: warn',
      ].join('\n')
    );
    expect(config.rules['typographic-punctuation']).toBe('warn');
    expect(config.rules.confusable).toBe('off');
    expect(config.overrides).toEqual([
      {
        patterns: ['legacy/**'],
        settings: { encoding: 'keep', rules: { 'zero-width': 'warn' } },
      },
    ]);
  });

  const INVALID = [
    ['an unknown setting', 'colour: blue', 'unknown setting "colour"'],
    ['an unknown rule', 'rules\n  no-such-rule: off', 'unknown rule'],
    ['a bad severity', 'rules\n  zero-width: loud', 'must be one of'],
    ['a bad choice', 'bom: sometimes', 'bom must be one of'],
    ['two values for one', 'line-endings: lf crlf', 'exactly one value'],
    ['a bad size', 'max-file-size: huge', 'max-file-size must look like'],
    ['a bad number', 'combining-mark-limit: -1', 'whole number'],
    ['an unknown script', 'allowed-scripts: Klingon', 'unknown script'],
    ['an unknown encoding', 'fallback-encoding: ebcdic-9', 'not supported'],
    ['a bad files key', "files\n  only: 'x'", 'expected include or exclude'],
    [
      'an unknown override setting',
      "overrides\n  '*.md'\n    colour: blue",
      'unknown setting "colour"',
    ],
  ];

  for (const [name, source, message] of INVALID) {
    it(`rejects ${name}`, () => {
      const error = configError(source);
      expect(error instanceof ConfigError).toBe(true);
      expect(error.message).toContain(message);
    });
  }
});

describe('settingsFor', () => {
  const config = parseConfig(
    [
      'rules',
      '  zero-width: error',
      'overrides',
      "  '*.bat' '*.cmd'",
      '    line-endings: crlf',
      "  'scripts'",
      '    rules',
      '      zero-width: warn',
      "  'scripts/legacy.cmd'",
      '    rules',
      '      zero-width: off',
    ].join('\n')
  );

  it('keeps the top level settings for other files', () => {
    const settings = settingsFor(config, 'src/index.js');
    expect(settings.lineEndings).toBe('lf');
    expect(settings.rules['zero-width']).toBe('error');
  });

  it('applies matching overrides in order, later ones winning', () => {
    expect(settingsFor(config, 'run.bat').lineEndings).toBe('crlf');
    expect(settingsFor(config, 'scripts/a.sh').rules['zero-width']).toBe(
      'warn'
    );
    const legacy = settingsFor(config, 'scripts/legacy.cmd');
    expect(legacy.lineEndings).toBe('crlf');
    expect(legacy.rules['zero-width']).toBe('off');
    expect(legacy.rules.confusable).toBe(config.rules.confusable);
  });

  it('does not change the configuration', () => {
    settingsFor(config, 'scripts/legacy.cmd');
    expect(config.rules['zero-width']).toBe('error');
    expect(config.lineEndings).toBe('lf');
  });
});

describe('isIncluded', () => {
  it('includes everything but the excluded files', () => {
    const config = parseConfig(
      "files\n  exclude\n    'vendor'\n    '*.min.js'"
    );
    expect(isIncluded(config, 'src/index.js')).toBe(true);
    expect(isIncluded(config, 'vendor/lib/a.js')).toBe(false);
    expect(isIncluded(config, 'dist/app.min.js')).toBe(false);
  });

  it('limits the files to the include list', () => {
    const config = parseConfig("files\n  include: 'docs' '*.md'");
    expect(isIncluded(config, 'docs/guide.txt')).toBe(true);
    expect(isIncluded(config, 'src/README.md')).toBe(true);
    expect(isIncluded(config, 'src/index.js')).toBe(false);
  });
});

describe('matchesGlob', () => {
  /** [pattern, path, matches] */
  const CASES = [
    ['*.md', 'README.md', true],
    ['*.md', 'docs/deep/guide.md', true],
    ['*.md', 'README.mdx', false],
    ['docs/*.md', 'docs/guide.md', true],
    ['docs/*.md', 'docs/deep/guide.md', false],
    ['docs/*.md', 'other/docs/guide.md', false],
    ['/docs', 'docs/a/b.txt', true],
    ['./docs/', 'docs/a.txt', true],
    ['docs/**/*.txt', 'docs/a.txt', true],
    ['docs/**/*.txt', 'docs/a/b/c.txt', true],
    ['**', 'any/path/at/all', true],
    ['node_modules', 'packages/x/node_modules/y/index.js', true],
    ['file?.js', 'file1.js', true],
    ['file?.js', 'file10.js', false],
    ['[ab].js', 'b.js', true],
    ['[!ab].js', 'b.js', false],
    ['[!ab].js', 'c.js', true],
    ['*.{js,mjs}', 'src/a.mjs', true],
    ['*.{js,mjs}', 'src/a.cjs', false],
    ['a+b.txt', 'a+b.txt', true],
    ['a+b.txt', 'aab.txt', false],
    ['(x).txt', '(x).txt', true],
  ];

  for (const [pattern, path, matches] of CASES) {
    it(`${matches ? 'matches' : 'does not match'} ${path} with ${pattern}`, () => {
      expect(matchesGlob(path, pattern)).toBe(matches);
    });
  }

  it('trims slashes in linear time', () => {
    const start = Date.now();
    expect(matchesGlob('a', `${'/'.repeat(20000)}a`)).toBe(false);
    expect(matchesGlob('a/b', `./a${'/'.repeat(20000)}`)).toBe(true);
    expect(Date.now() - start).toBeLessThan(200);
  });
});
