/**
 * watermarks-remover: finds and removes invisible characters, hidden
 * payloads, AI chat artifacts, provenance manifests, look-alike letters,
 * mixed line endings, byte order marks, legacy encodings and image
 * metadata.
 *
 * This entry point never touches the file system, so it also runs in
 * browsers. File system helpers live in `@link-foundation/watermarks-remover/node`.
 */

export { checkFile, textOptions } from './engine.js';
export { createLocator, fixText, scanText } from './text-rules.js';
export {
  CONFIG_FILE,
  ConfigError,
  STARTER_CONFIG,
  defaultConfig,
  isIncluded,
  parseConfig,
  settingsFor,
} from './config.js';
export {
  RULES,
  RULE_IDS,
  SEVERITIES,
  defaultSeverities,
  getRule,
} from './rules.js';
export { decode, encode, normalizeEncoding } from './encoding.js';
export { stripImageMetadata } from './images.js';
export { escapeInvisible } from './payload.js';
export { matchesGlob } from './glob.js';
export {
  FORMATS,
  formatReport,
  formatStepSummary,
  summarize,
} from './reporters.js';
