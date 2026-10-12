/**
 * The Node.js side: finds files, loads the configuration, runs the engine
 * and writes fixes back.
 */

import { execFile } from 'node:child_process';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

import {
  CONFIG_FILE,
  ConfigError,
  defaultConfig,
  isIncluded,
  parseConfig,
  settingsFor,
} from './config.js';
import { checkFile } from './engine.js';

/**
 * @typedef {import('./config.js').Config} Config
 * @typedef {import('./engine.js').FileResult} FileResult
 */

const run = promisify(execFile);

/** Directories never worth walking when git is not available. */
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules']);

/**
 * @param {string} root
 * @param {string} [configPath] an explicit file, which must exist
 * @returns {Promise<Config>}
 */
export async function loadConfig(root, configPath) {
  const path = resolve(root, configPath ?? CONFIG_FILE);
  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT' && !configPath) {
      return defaultConfig();
    }
    throw new ConfigError(`cannot read ${path}: ${error.message}`);
  }
  try {
    return parseConfig(source);
  } catch (error) {
    throw new ConfigError(`${relative(root, path) || path}: ${error.message}`);
  }
}

/**
 * @param {string} path
 * @returns {string} the path with forward slashes
 */
const toPosix = (path) => path.split(sep).join('/');

/**
 * @param {string} root
 * @returns {Promise<string[]|null>} tracked and untracked, not ignored
 *   files, or null outside a git work tree
 */
async function gitFiles(root) {
  try {
    const { stdout } = await run(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { cwd: root, maxBuffer: 256 * 1024 * 1024 }
    );
    return [...new Set(stdout.split('\0').filter(Boolean))];
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 * @param {string} [directory]
 * @returns {Promise<string[]>}
 */
async function walk(root, directory = '') {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) {
      files.push(...(await walk(root, path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

/**
 * @param {string} root
 * @param {string[]} paths files or directories given on the command line
 * @param {Config} config
 * @returns {Promise<string[]>} relative paths with forward slashes, sorted
 */
export async function listFiles(root, paths, config) {
  const all = (await gitFiles(root)) ?? (await walk(root));
  const selected = new Set();
  const prefixes = [];
  for (const path of paths) {
    const relativePath = toPosix(relative(root, resolve(root, path)));
    const stats = await lstat(resolve(root, path));
    if (stats.isFile()) {
      selected.add(relativePath);
    } else {
      prefixes.push(relativePath === '' ? '' : `${relativePath}/`);
    }
  }
  if (paths.length === 0) {
    prefixes.push('');
  }
  for (const path of all) {
    if (
      prefixes.some((prefix) => path.startsWith(prefix)) &&
      isIncluded(config, path)
    ) {
      selected.add(path);
    }
  }
  return [...selected].sort();
}

/**
 * @param {string} root
 * @param {string} path
 * @returns {Promise<Uint8Array|null>} null for symbolic links, submodules
 *   and files deleted from the work tree
 */
async function readRegularFile(root, path) {
  try {
    const stats = await lstat(join(root, path));
    return stats.isFile()
      ? new Uint8Array(await readFile(join(root, path)))
      : null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * @typedef {object} RunOptions
 * @property {string} [root] defaults to the current directory
 * @property {string[]} [paths] files or directories, defaults to everything
 * @property {boolean} [fix] write repaired files
 * @property {string} [configPath]
 *
 * @typedef {FileResult & { before?: import('./engine.js').Finding[] }} CheckedFile
 *   a fixed file is checked again; `before` holds the findings it had
 *
 * @typedef {object} RunResult
 * @property {CheckedFile[]} files every checked file
 * @property {string[]} fixed paths of the rewritten files
 */

/**
 * @param {RunOptions} [options]
 * @returns {Promise<RunResult>}
 */
export async function checkFiles({
  root = process.cwd(),
  paths = [],
  fix = false,
  configPath,
} = {}) {
  const config = await loadConfig(root, configPath);
  const files = [];
  const fixed = [];
  for (const path of await listFiles(root, paths, config)) {
    const bytes = await readRegularFile(root, path);
    if (!bytes) {
      continue;
    }
    const settings = settingsFor(config, path);
    let result = checkFile(path, bytes, settings, { fix });
    if (result.fixed) {
      await writeFile(join(root, path), result.fixed);
      fixed.push(path);
      result = {
        ...checkFile(path, result.fixed, settings),
        before: result.findings,
      };
    }
    files.push(result);
  }
  return { files, fixed };
}
