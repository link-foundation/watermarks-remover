/**
 * Output formats: `text` for people, `github` for workflow annotations,
 * `json` for scripts and `sarif` for code scanning. Every message is
 * escaped so that the report itself never carries invisible characters.
 */

import { escapeInvisible } from './payload.js';
import { RULES } from './rules.js';

/**
 * @typedef {import('./engine.js').Finding} Finding
 * @typedef {import('./run.js').RunResult} RunResult
 *
 * @typedef {object} ReportContext
 * @property {string} name the command, for the --fix hint
 * @property {string} version
 * @property {string} fixCommand the command that repairs the findings
 */

export const FORMATS = ['text', 'github', 'json', 'sarif'];

/**
 * @param {RunResult} result
 * @returns {Finding[]}
 */
const allFindings = (result) => result.files.flatMap((file) => file.findings);

/**
 * @param {RunResult} result
 * @returns {{ files: number, errors: number, warnings: number,
 *   fixable: number, fixed: number, fixedFiles: number }}
 */
export function summarize(result) {
  const findings = allFindings(result);
  const count = (predicate) => findings.filter(predicate).length;
  return {
    files: result.files.length,
    errors: count((found) => found.severity === 'error'),
    warnings: count((found) => found.severity === 'warn'),
    fixable: count((found) => found.fixable),
    fixed: result.files.reduce(
      (sum, file) =>
        sum + (file.before ? file.before.length - file.findings.length : 0),
      0
    ),
    fixedFiles: result.fixed.length,
  };
}

/**
 * @param {Finding} found
 * @returns {string} `path:line:column` or the bare path for file findings
 */
const position = (found) =>
  found.line > 0 ? `${found.path}:${found.line}:${found.column}` : found.path;

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * @param {RunResult} result
 * @param {ReportContext} context
 * @returns {string[]} closing lines shared by text and github output
 */
function closing(result, context) {
  const summary = summarize(result);
  const lines = [];
  if (summary.fixedFiles > 0) {
    lines.push(
      `Fixed ${plural(summary.fixed, 'problem')} in ${plural(summary.fixedFiles, 'file')}.`
    );
  }
  if (summary.errors + summary.warnings === 0) {
    lines.push(`No problems found in ${plural(summary.files, 'file')}.`);
    return lines;
  }
  lines.push(
    `${plural(summary.errors + summary.warnings, 'problem')} (${plural(summary.errors, 'error')}, ${plural(summary.warnings, 'warning')}) in ${plural(summary.files, 'checked file')}.`
  );
  if (summary.fixable > 0) {
    lines.push(
      `${summary.fixable} can be fixed automatically: run \`${context.fixCommand}\` and commit the result.`
    );
  }
  return lines;
}

/**
 * @param {RunResult} result
 * @param {ReportContext} context
 * @returns {string}
 */
function formatText(result, context) {
  const lines = allFindings(result).map(
    (found) =>
      `${position(found)}  ${found.severity === 'error' ? 'error' : 'warning'}  ${escapeInvisible(found.message)}  ${found.rule}`
  );
  if (lines.length > 0) {
    lines.push('');
  }
  return [...lines, ...closing(result, context)].join('\n');
}

/**
 * @param {string} value
 * @returns {string} the value escaped for a workflow command message
 */
const escapeData = (value) =>
  value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

/**
 * @param {string} value
 * @returns {string} the value escaped for a workflow command property
 */
const escapeProperty = (value) =>
  escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');

/**
 * @param {RunResult} result
 * @param {ReportContext} context
 * @returns {string}
 */
function formatGithub(result, context) {
  const lines = allFindings(result).map((found) => {
    const level = found.severity === 'error' ? 'error' : 'warning';
    const where =
      found.line > 0 ? `,line=${found.line},col=${found.column}` : '';
    const title = escapeProperty(`${context.name} (${found.rule})`);
    const hint = found.fixable ? ` Run ${context.fixCommand} to fix.` : '';
    const message = escapeData(`${escapeInvisible(found.message)}.${hint}`);
    return `::${level} file=${escapeProperty(found.path)}${where},title=${title}::${message}`;
  });
  return [...lines, ...closing(result, context)].join('\n');
}

/**
 * @param {RunResult} result
 * @param {ReportContext} context
 * @returns {string} Markdown for `$GITHUB_STEP_SUMMARY`
 */
export function formatStepSummary(result, context) {
  const findings = allFindings(result);
  const lines = [`## ${context.name}`, '', ...closing(result, context)];
  if (findings.length > 0) {
    lines.push('', '| Location | Rule | Problem |', '| --- | --- | --- |');
    for (const found of findings.slice(0, 200)) {
      const cell = (value) =>
        escapeInvisible(value).replace(/\|/g, '\\|').replace(/`/g, "'");
      lines.push(
        `| \`${cell(position(found))}\` | ${found.rule} | ${cell(found.message)} |`
      );
    }
    if (findings.length > 200) {
      lines.push('', `${findings.length - 200} more problems are not shown.`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * @param {RunResult} result
 * @param {ReportContext} context
 * @returns {string}
 */
function formatJson(result, context) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      tool: { name: context.name, version: context.version },
      summary: summarize(result),
      fixedFiles: result.fixed,
      findings: allFindings(result).map((found) => ({
        ...found,
        message: escapeInvisible(found.message),
      })),
    },
    null,
    2
  );
}

const SARIF_LEVELS = { error: 'error', warn: 'warning', off: 'none' };

/**
 * @param {RunResult} result
 * @param {ReportContext} context
 * @returns {string} SARIF 2.1.0
 */
function formatSarif(result, context) {
  const results = allFindings(result).map((found) => {
    const location = { artifactLocation: { uri: encodeURI(found.path) } };
    if (found.line > 0) {
      location.region = { startLine: found.line, startColumn: found.column };
    }
    return {
      ruleId: found.rule,
      level: SARIF_LEVELS[found.severity],
      message: { text: escapeInvisible(found.message) },
      locations: [{ physicalLocation: location }],
    };
  });
  return JSON.stringify(
    {
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: context.name,
              version: context.version,
              informationUri:
                'https://github.com/link-foundation/watermarks-remover',
              rules: RULES.map((rule) => ({
                id: rule.id,
                shortDescription: { text: rule.summary },
                defaultConfiguration: { level: SARIF_LEVELS[rule.severity] },
              })),
            },
          },
          results,
        },
      ],
    },
    null,
    2
  );
}

const FORMATTERS = {
  text: formatText,
  github: formatGithub,
  json: formatJson,
  sarif: formatSarif,
};

/**
 * @param {RunResult} result
 * @param {string} format one of FORMATS
 * @param {ReportContext} context
 * @returns {string}
 */
export const formatReport = (result, format, context) =>
  FORMATTERS[format](result, context);
