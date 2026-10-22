/**
 * Configuration lives in `.watermarks-remover.lino`, written in Links
 * Notation: one `key: value` per line, indented children for groups.
 *
 *   encoding: utf-8
 *   line-endings: lf
 *   files
 *     exclude
 *       'vendor/**'
 *   rules
 *     typographic-punctuation: warn
 *   overrides
 *     '**\/*.bat'
 *       line-endings: crlf
 */

import { Parser } from 'links-notation';
import { matchesGlob } from './glob.js';
import { RULE_IDS, SEVERITIES, defaultSeverities } from './rules.js';
import { DEFAULT_COMBINING_MARK_LIMIT } from './text-rules.js';
import { normalizeEncoding } from './encoding.js';
import { scriptPattern } from './unicode-data.js';

export const CONFIG_FILE = '.watermarks-remover.lino';

/**
 * @typedef {import('./rules.js').Severity} Severity
 *
 * @typedef {object} Settings
 * @property {'utf-8'|'keep'} encoding
 * @property {string} fallbackEncoding used for files that are not UTF-8
 * @property {'remove'|'require'|'keep'} bom
 * @property {'lf'|'crlf'|'keep'} lineEndings
 * @property {string[]|null} allowedScripts null allows every script
 * @property {number} combiningMarkLimit
 * @property {boolean} markdownHardBreaks keep two-space line breaks in Markdown
 * @property {number} maxFileSize larger files are skipped, in bytes
 * @property {Record<string, Severity>} rules
 *
 * @typedef {object} Override
 * @property {string[]} patterns
 * @property {Partial<Settings>} settings
 *
 * @typedef {Settings & { include: string[], exclude: string[],
 *   overrides: Override[] }} Config
 */

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** @returns {Config} */
export const defaultConfig = () => ({
  include: ['**'],
  exclude: [],
  encoding: 'utf-8',
  fallbackEncoding: 'windows-1252',
  bom: 'remove',
  lineEndings: 'lf',
  allowedScripts: null,
  combiningMarkLimit: DEFAULT_COMBINING_MARK_LIMIT,
  markdownHardBreaks: true,
  maxFileSize: 10 * 1024 * 1024,
  rules: defaultSeverities(),
  overrides: [],
});

/**
 * @param {string} key
 * @param {string[]} allowed
 * @returns {(values: string[]) => string}
 */
const oneOf = (key, allowed) => (values) => {
  const [value] = single(key, values);
  if (!allowed.includes(value)) {
    throw new ConfigError(
      `${key} must be one of ${allowed.join(', ')}, got "${value}"`
    );
  }
  return value;
};

/**
 * @param {string} key
 * @param {string[]} values
 * @returns {string[]}
 */
function single(key, values) {
  if (values.length !== 1) {
    throw new ConfigError(`${key} takes exactly one value`);
  }
  return values;
}

const SIZE = /^(\d+)\s*(b|kb|mb|gb)?$/i;
const SIZE_UNITS = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

/** Readers for every scalar setting, keyed by their name in the file. */
const SETTINGS = {
  encoding: ['encoding', oneOf('encoding', ['utf-8', 'keep'])],
  'fallback-encoding': [
    'fallbackEncoding',
    (values) => {
      const [label] = single('fallback-encoding', values);
      const encoding = normalizeEncoding(label);
      if (!encoding) {
        throw new ConfigError(`fallback-encoding "${label}" is not supported`);
      }
      return encoding;
    },
  ],
  bom: ['bom', oneOf('bom', ['remove', 'require', 'keep'])],
  'line-endings': [
    'lineEndings',
    oneOf('line-endings', ['lf', 'crlf', 'keep']),
  ],
  'allowed-scripts': [
    'allowedScripts',
    (values) => {
      if (values.length === 1 && values[0] === 'all') {
        return null;
      }
      for (const script of values) {
        try {
          scriptPattern(script);
        } catch {
          throw new ConfigError(`allowed-scripts: unknown script "${script}"`);
        }
      }
      return values;
    },
  ],
  'combining-mark-limit': [
    'combiningMarkLimit',
    (values) => {
      const [value] = single('combining-mark-limit', values);
      if (!/^\d+$/.test(value)) {
        throw new ConfigError(
          `combining-mark-limit must be a whole number, got "${value}"`
        );
      }
      return Number(value);
    },
  ],
  'markdown-hard-breaks': [
    'markdownHardBreaks',
    (values) =>
      oneOf('markdown-hard-breaks', ['true', 'false'])(values) === 'true',
  ],
  'max-file-size': [
    'maxFileSize',
    (values) => {
      const [value] = single('max-file-size', values);
      const match = SIZE.exec(value);
      if (!match) {
        throw new ConfigError(
          `max-file-size must look like 512kb or 10mb, got "${value}"`
        );
      }
      return Number(match[1]) * SIZE_UNITS[(match[2] ?? 'b').toLowerCase()];
    },
  ],
};

/**
 * @typedef {object} Entry
 * @property {string} key
 * @property {string[]} values
 * @property {Entry[]} children
 */

/**
 * @param {object} link a parsed link
 * @returns {string[]}
 */
function linkValues(link) {
  return (link.values ?? []).map((value) => {
    if (typeof value.id !== 'string' || (value.values ?? []).length > 0) {
      throw new ConfigError('nested links are not supported in configuration');
    }
    return value.id;
  });
}

/**
 * @param {object[]} groups output of `Parser.parseGroups`
 * @returns {Entry[]}
 */
function toEntries(groups) {
  return groups.map((group) => {
    const link = group.element ?? group;
    const values = linkValues(link);
    const children = toEntries(group.children ?? []);
    if (typeof link.id === 'string') {
      return { key: link.id, values, children };
    }
    const [key, ...rest] = values;
    return { key, values: rest, children };
  });
}

/**
 * Values can be written inline (`include: '*.md' '*.txt'`) or as children,
 * one per line.
 *
 * @param {Entry} entry
 * @returns {string[]}
 */
const listValues = (entry) => [
  ...entry.values,
  ...entry.children.flatMap((child) => [child.key, ...child.values]),
];

/**
 * @param {Entry[]} entries
 * @param {string} context where the entries are, for error messages
 * @returns {Record<string, Severity>}
 */
function readRules(entries, context) {
  const rules = {};
  for (const { key, values } of entries) {
    if (!RULE_IDS.includes(key)) {
      throw new ConfigError(
        `${context}: unknown rule "${key}", run --list-rules to see them`
      );
    }
    rules[key] = oneOf(`${context} ${key}`, SEVERITIES)(values);
  }
  return rules;
}

/**
 * @param {Entry} entry
 * @param {Partial<Settings>} target
 * @param {string} context
 * @returns {boolean} whether the entry was a setting
 */
function readSetting(entry, target, context) {
  if (entry.key === 'rules') {
    target.rules = { ...target.rules, ...readRules(entry.children, context) };
    return true;
  }
  const setting = SETTINGS[entry.key];
  if (!setting) {
    return false;
  }
  const [property, read] = setting;
  target[property] = read(entry.values);
  return true;
}

/**
 * @param {Entry} entry the `overrides` group
 * @returns {Override[]}
 */
function readOverrides(entry) {
  return entry.children.map((child) => {
    const patterns = [child.key, ...child.values];
    const settings = {};
    for (const setting of child.children) {
      if (!readSetting(setting, settings, `overrides ${child.key}`)) {
        throw new ConfigError(
          `overrides ${child.key}: unknown setting "${setting.key}"`
        );
      }
    }
    return { patterns, settings };
  });
}

/**
 * @param {Entry} entry the `files` group
 * @param {Config} config
 */
function readFiles(entry, config) {
  for (const child of entry.children) {
    if (child.key !== 'include' && child.key !== 'exclude') {
      throw new ConfigError(
        `files: expected include or exclude, got "${child.key}"`
      );
    }
    config[child.key] = listValues(child);
  }
}

/**
 * @param {string} source contents of a `.watermarks-remover.lino` file
 * @returns {Config}
 * @throws {ConfigError}
 */
export function parseConfig(source) {
  let groups;
  try {
    groups = new Parser().parseGroups(source);
  } catch (error) {
    throw new ConfigError(`invalid Links Notation: ${error.message}`);
  }
  const config = defaultConfig();
  for (const entry of toEntries(groups)) {
    if (entry.key === 'files') {
      readFiles(entry, config);
    } else if (entry.key === 'overrides') {
      config.overrides.push(...readOverrides(entry));
    } else if (!readSetting(entry, config, 'rules')) {
      throw new ConfigError(`unknown setting "${entry.key}"`);
    }
  }
  return config;
}

/**
 * @param {Config} config
 * @param {string} path relative, with forward slashes
 * @returns {Settings} the settings for one file, overrides applied in order
 */
export function settingsFor(config, path) {
  let settings = { ...config, rules: { ...config.rules } };
  for (const override of config.overrides) {
    if (override.patterns.some((pattern) => matchesGlob(path, pattern))) {
      settings = {
        ...settings,
        ...override.settings,
        rules: { ...settings.rules, ...override.settings.rules },
      };
    }
  }
  return settings;
}

/**
 * @param {Config} config
 * @param {string} path relative, with forward slashes
 * @returns {boolean}
 */
export const isIncluded = (config, path) =>
  config.include.some((pattern) => matchesGlob(path, pattern)) &&
  !config.exclude.some((pattern) => matchesGlob(path, pattern));

/** The file written by `--init`. */
export const STARTER_CONFIG = `# Configuration of watermarks-remover, written in Links Notation.
# Every setting is optional; the values below are the defaults.

# utf-8 converts every text file to UTF-8, keep leaves encodings alone.
encoding: utf-8
# How to read text files that are not valid UTF-8.
fallback-encoding: windows-1252
# remove, require or keep the UTF-8 byte order mark.
bom: remove
# lf, crlf or keep.
line-endings: lf
# Letters of other scripts are reported, for example: Latin Cyrillic Greek
allowed-scripts: all
combining-mark-limit: 6
markdown-hard-breaks: true
max-file-size: 10mb

files
  include
    '**'
  exclude
    'node_modules'

# Severities are error, warn or off. Run --list-rules to see every rule.
rules
  typographic-punctuation: off
  escaped-character: warn

# Settings for matching files, applied in order.
overrides
  '*.bat' '*.cmd'
    line-endings: crlf
`;
