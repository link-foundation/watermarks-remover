#!/usr/bin/env node

import {
  appendFileSync,
  existsSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { parseArgs } from 'node:util';

import {
  CONFIG_FILE,
  ConfigError,
  STARTER_CONFIG,
  checkFile,
  checkFiles,
  loadConfig,
  settingsFor,
} from '../src/node.js';
import {
  FORMATS,
  formatReport,
  formatStepSummary,
  summarize,
} from '../src/reporters.js';
import { RULES } from '../src/rules.js';

const NAME = 'watermarks-remover';
const PACKAGE = '@link-foundation/watermarks-remover';

const OPTIONS = {
  fix: { type: 'boolean' },
  config: { type: 'string' },
  format: { type: 'string' },
  output: { type: 'string' },
  stdin: { type: 'boolean' },
  'stdin-filename': { type: 'string' },
  quiet: { type: 'boolean' },
  'list-rules': { type: 'boolean' },
  init: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
};

function usage() {
  return [
    `Usage: ${NAME} [options] [paths...]`,
    '',
    'Finds hidden characters, watermarks and encoding problems in text files',
    'and image metadata. Fails when it finds any; --fix repairs them.',
    '',
    'Options:',
    '  --fix                 Repair what can be repaired, in place',
    `  --config <file>       Configuration file (default: ${CONFIG_FILE})`,
    `  --format <name>       ${FORMATS.join(', ')} (default: github on GitHub Actions, else text)`,
    '  --output <file>       Write the report to a file',
    '  --stdin               Check standard input; with --fix print the fixed text',
    '  --stdin-filename <p>  Path used to pick settings for standard input',
    '  --quiet               Report errors only',
    '  --list-rules          List every rule',
    `  --init                Write a starter ${CONFIG_FILE}`,
    '  -h, --help            Show this help',
    '  -v, --version         Show the version and the Unicode version',
    '',
    'Exit codes: 0 clean, 1 problems found, 2 usage or configuration error.',
  ].join('\n');
}

function readVersion() {
  const packageUrl = new URL('../package.json', import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageUrl, 'utf8'));
  return packageJson.version;
}

function listRules() {
  const width = Math.max(...RULES.map((rule) => rule.id.length));
  return RULES.map(
    (rule) =>
      `${rule.id.padEnd(width)}  ${rule.severity.padEnd(5)}  ${rule.fixable ? 'fix' : '   '}  ${rule.summary}`
  ).join('\n');
}

/**
 * @param {{ positionals: string[], values: object }} args
 * @returns {string} the command that repairs what this run found
 */
function fixCommand({ positionals, values }) {
  const parts = [`npx ${PACKAGE} --fix`];
  if (values.config) {
    parts.push(`--config ${values.config}`);
  }
  return [...parts, ...positionals].join(' ');
}

/**
 * @param {object} io
 * @returns {Promise<Uint8Array>}
 */
async function readStdin(io) {
  if (io.readStdin) {
    return io.readStdin();
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/**
 * @param {{ values: object }} args
 * @param {object} io
 * @param {string} cwd
 * @returns {Promise<import('../src/run.js').RunResult>}
 */
async function checkStdin({ values }, io, cwd) {
  const config = await loadConfig(cwd, values.config);
  const path = values['stdin-filename'] ?? '<stdin>';
  const bytes = await readStdin(io);
  const result = checkFile(path, bytes, settingsFor(config, path), {
    fix: values.fix,
  });
  if (values.fix) {
    (io.writeBytes ?? ((data) => process.stdout.write(data)))(
      result.fixed ?? bytes
    );
    const after = checkFile(
      path,
      result.fixed ?? bytes,
      settingsFor(config, path)
    );
    return {
      files: [{ ...after, before: result.findings }],
      fixed: result.fixed ? [path] : [],
    };
  }
  return { files: [result], fixed: [] };
}

/**
 * @param {import('../src/run.js').RunResult} result
 * @returns {import('../src/run.js').RunResult} the result without warnings
 */
const withoutWarnings = (result) => ({
  ...result,
  files: result.files.map((file) => ({
    ...file,
    findings: file.findings.filter((found) => found.severity === 'error'),
  })),
});

/**
 * @param {object} args
 * @param {object} io
 * @param {{ cwd: string, env: object }} context
 * @returns {Promise<number>}
 */
async function check(args, io, { cwd, env }) {
  const { values, positionals } = args;
  const format =
    values.format ?? (env.GITHUB_ACTIONS === 'true' ? 'github' : 'text');
  if (!FORMATS.includes(format)) {
    io.stderr(
      `Unknown format "${format}", expected one of ${FORMATS.join(', ')}`
    );
    return 2;
  }
  let result = values.stdin
    ? await checkStdin(args, io, cwd)
    : await checkFiles({
        root: cwd,
        paths: positionals,
        fix: values.fix,
        configPath: values.config,
      });
  if (values.quiet) {
    result = withoutWarnings(result);
  }
  const context = {
    name: NAME,
    version: readVersion(),
    fixCommand: fixCommand(args),
  };
  const report = formatReport(result, format, context);
  if (values.output) {
    writeFileSync(join(cwd, values.output), `${report}\n`);
  } else {
    (values.stdin && values.fix ? io.stderr : io.stdout)(report);
  }
  if (format === 'github' && env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, formatStepSummary(result, context));
  }
  return summarize(result).errors > 0 ? 1 : 0;
}

/**
 * @param {string[]} argv
 * @param {object} [io]
 * @returns {Promise<number>} the exit code
 */
export async function runCli(argv, io = {}) {
  const output = {
    stdout: io.stdout ?? console.log,
    stderr: io.stderr ?? console.error,
    readStdin: io.readStdin,
    writeBytes: io.writeBytes,
  };
  const cwd = io.cwd ?? process.cwd();
  const env = io.env ?? process.env;
  let args;
  try {
    args = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (error) {
    output.stderr(error.message);
    output.stderr(usage());
    return 2;
  }
  const { values } = args;
  if (values.help) {
    output.stdout(usage());
    return 0;
  }
  if (values.version) {
    const unicode = process.versions.unicode;
    output.stdout(
      unicode ? `${readVersion()} (Unicode ${unicode})` : readVersion()
    );
    return 0;
  }
  if (values['list-rules']) {
    output.stdout(listRules());
    return 0;
  }
  if (values.init) {
    const path = join(cwd, CONFIG_FILE);
    if (existsSync(path)) {
      output.stderr(`${CONFIG_FILE} already exists`);
      return 2;
    }
    writeFileSync(path, STARTER_CONFIG);
    output.stdout(`Wrote ${CONFIG_FILE}`);
    return 0;
  }
  try {
    return await check(args, output, { cwd, env });
  } catch (error) {
    if (error instanceof ConfigError) {
      output.stderr(`Configuration error: ${error.message}`);
      return 2;
    }
    throw error;
  }
}

function isCliEntryPoint() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return (
      realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isCliEntryPoint()) {
  process.exitCode = await runCli(process.argv.slice(2));
}
