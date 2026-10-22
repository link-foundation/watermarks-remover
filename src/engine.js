/**
 * Checks and fixes one file given as bytes. Nothing here touches the file
 * system, so the engine also runs in browsers.
 */

import { decode, encode } from './encoding.js';
import { stripImageMetadata } from './images.js';
import { getRule } from './rules.js';
import { createLocator, fixText, scanText } from './text-rules.js';

/**
 * @typedef {import('./config.js').Settings} Settings
 * @typedef {import('./rules.js').Severity} Severity
 *
 * @typedef {object} Finding
 * @property {string} path
 * @property {number} line 1-based, 0 when the finding is about the file
 * @property {number} column 1-based in code points, 0 for the file
 * @property {string} rule
 * @property {Severity} severity
 * @property {string} message
 * @property {boolean} fixable
 *
 * @typedef {object} FileResult
 * @property {string} path
 * @property {'text'|'image'|'binary'|'too-large'} kind
 * @property {string} [encoding] of a text file
 * @property {Finding[]} findings
 * @property {Uint8Array|null} fixed new contents, null when unchanged
 */

const MARKDOWN = /\.(?:md|markdown|mdx|mkd)$/i;
const WIDE = /^utf-(?:16|32)/;

/**
 * @param {Settings} settings
 * @param {string} rule
 * @returns {Severity}
 */
const severityOf = (settings, rule) => settings.rules[rule] ?? 'off';

/**
 * @param {string} path
 * @param {Settings} settings
 * @param {string} rule
 * @param {string} message
 * @param {{ line?: number, column?: number, fixable?: boolean }} [where]
 * @returns {Finding}
 */
const finding = (path, settings, rule, message, where = {}) => ({
  path,
  line: where.line ?? 0,
  column: where.column ?? 0,
  rule,
  severity: severityOf(settings, rule),
  message,
  fixable: where.fixable ?? getRule(rule).fixable,
});

/**
 * @param {string} path
 * @param {Settings} settings
 * @returns {import('./text-rules.js').TextOptions}
 */
export const textOptions = (path, settings) => ({
  severities: settings.rules,
  allowedScripts: settings.allowedScripts,
  lineEndings: settings.lineEndings,
  combiningMarkLimit: settings.combiningMarkLimit,
  markdown: settings.markdownHardBreaks && MARKDOWN.test(path),
});

/**
 * The file name itself can carry invisible or look-alike characters.
 *
 * @param {string} path
 * @param {Settings} settings
 * @returns {Finding[]}
 */
function checkFileName(path, settings) {
  if (
    severityOf(settings, 'file-name') === 'off' ||
    /^[\x20-\x7e]*$/.test(path)
  ) {
    return [];
  }
  const severities = { ...settings.rules };
  for (const rule of ['line-endings', 'final-newline', 'trailing-whitespace']) {
    severities[rule] = 'off';
  }
  return scanText(path, { severities }).map((edit) =>
    finding(path, settings, 'file-name', `${edit.rule}: ${edit.message}`)
  );
}

/**
 * @param {string} path
 * @param {Uint8Array} bytes
 * @param {Settings} settings
 * @param {boolean} fix
 * @returns {FileResult|null} null when the file is not an image
 */
function checkImage(path, bytes, settings, fix) {
  const image = stripImageMetadata(bytes);
  if (!image) {
    return null;
  }
  const enabled = severityOf(settings, 'image-metadata') !== 'off';
  const removed = enabled ? image.removed : [];
  return {
    path,
    kind: 'image',
    findings: removed.map((block) =>
      finding(
        path,
        settings,
        'image-metadata',
        `${image.format} metadata block ${block}`
      )
    ),
    fixed: fix && removed.length > 0 ? image.bytes : null,
  };
}

/**
 * @param {string} path
 * @param {import('./encoding.js').Decoded} decoded
 * @param {Settings} settings
 * @returns {{ findings: Finding[], target: { encoding: string, bom: boolean } }}
 */
function checkBytes(path, decoded, settings) {
  const findings = [];
  let encoding = decoded.encoding;
  if (settings.encoding === 'utf-8' && encoding !== 'utf-8') {
    findings.push(
      finding(
        path,
        settings,
        'encoding',
        `encoded as ${encoding}, expected UTF-8`
      )
    );
    encoding = severityOf(settings, 'encoding') === 'off' ? encoding : 'utf-8';
  }
  let bom = decoded.bom;
  if (WIDE.test(encoding)) {
    bom = true;
  } else if (settings.bom !== 'keep' && bom !== (settings.bom === 'require')) {
    findings.push(
      finding(
        path,
        settings,
        'bom',
        bom ? 'starts with a byte order mark' : 'has no byte order mark'
      )
    );
    bom = severityOf(settings, 'bom') === 'off' ? bom : !bom;
  }
  return { findings, target: { encoding, bom } };
}

/**
 * @param {string} text
 * @param {{ encoding: string, bom: boolean }} target
 * @returns {Uint8Array|null} null when the text cannot be written back
 */
function encodeExactly(text, target) {
  try {
    const bytes = encode(text, target);
    return decode(bytes, { fallbackEncoding: target.encoding }).text === text
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * @param {Uint8Array} left
 * @param {Uint8Array} right
 * @returns {boolean}
 */
const sameBytes = (left, right) =>
  left.length === right.length &&
  left.every((byte, index) => byte === right[index]);

/**
 * @param {string} path relative, with forward slashes
 * @param {Uint8Array} bytes
 * @param {Settings} settings
 * @param {{ fix?: boolean }} [options]
 * @returns {FileResult}
 */
export function checkFile(path, bytes, settings, { fix = false } = {}) {
  const names = checkFileName(path, settings);
  if (bytes.length > settings.maxFileSize) {
    return { path, kind: 'too-large', findings: names, fixed: null };
  }
  const image = checkImage(path, bytes, settings, fix);
  if (image) {
    return { ...image, findings: [...names, ...image.findings] };
  }
  const decoded = decode(bytes, settings);
  if (decoded.binary) {
    return { path, kind: 'binary', findings: names, fixed: null };
  }
  const { findings, target } = checkBytes(path, decoded, settings);
  const options = textOptions(path, settings);
  const locate = createLocator(decoded.text);
  for (const edit of scanText(decoded.text, options)) {
    findings.push(
      finding(path, settings, edit.rule, edit.message, {
        ...locate(edit.index),
        fixable: edit.replacement !== null || Boolean(edit.fix),
      })
    );
  }
  const result = {
    path,
    kind: 'text',
    encoding: decoded.encoding,
    findings: [...names, ...findings].filter(
      (found) => found.severity !== 'off'
    ),
    fixed: null,
  };
  if (fix) {
    const output = encodeExactly(fixText(decoded.text, options), target);
    if (!output) {
      result.findings.push(
        finding(
          path,
          settings,
          'encoding',
          `the fixed text cannot be written as ${target.encoding}`,
          { fixable: false }
        )
      );
    } else if (!sameBytes(output, bytes)) {
      result.fixed = output;
    }
  }
  return result;
}
