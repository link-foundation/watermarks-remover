/**
 * The command line: exit codes, --fix, --stdin, --init, every report format
 * and file discovery with and without git. Each test works in its own
 * temporary directory.
 */

import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, it, expect } from 'test-anywhere';

import { runCli } from '../bin/watermarks-remover.js';
import { RULES, listFiles, defaultConfig } from '../src/node.js';

const FIX_HINT = 'npx @link-foundation/watermarks-remover --fix';
const DIRTY = 'Hello\u{200B} world\n';

/**
 * @param {Record<string, string|Uint8Array>} files
 * @returns {string} a new directory holding the files
 */
function project(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'watermarks-remover-'));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

/**
 * @param {string} root
 * @param {string[]} argv
 * @param {object} [io]
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
async function cli(root, argv, io = {}) {
  const stdout = [];
  const stderr = [];
  const code = await runCli(argv, {
    cwd: root,
    env: {},
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
    ...io,
  });
  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}

/**
 * @param {Record<string, string|Uint8Array>} files
 * @param {(root: string) => Promise<void>} body
 */
async function inProject(files, body) {
  const root = project(files);
  try {
    await body(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

const read = (root, path) => readFileSync(join(root, path), 'utf8');

describe('checking files', () => {
  it('exits with 0 for a clean project', async () => {
    await inProject(
      { 'a.txt': 'clean\n', 'b/c.md': '# Title\n' },
      async (root) => {
        const result = await cli(root, []);
        expect(result.code).toBe(0);
        expect(result.stdout).toBe('No problems found in 2 files.');
      }
    );
  });

  it('exits with 1 and names the fix command', async () => {
    await inProject({ 'a.txt': DIRTY }, async (root) => {
      const result = await cli(root, []);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('a.txt:1:6  error');
      expect(result.stdout).toContain('zero-width');
      expect(result.stdout).toContain(FIX_HINT);
      expect(result.stdout).toContain('1 problem (1 error, 0 warnings)');
      expect(/^[\t\n -~]*$/u.test(result.stdout)).toBe(true);
    });
  });

  it('repairs the files with --fix and passes afterwards', async () => {
    await inProject(
      { 'a.txt': DIRTY, 'b.txt': 'line\r\nend' },
      async (root) => {
        const fixed = await cli(root, ['--fix']);
        expect(fixed.code).toBe(0);
        expect(fixed.stdout).toContain('Fixed 3 problems in 2 files.');
        expect(read(root, 'a.txt')).toBe('Hello world\n');
        expect(read(root, 'b.txt')).toBe('line\nend\n');
        expect((await cli(root, [])).code).toBe(0);
      }
    );
  });

  it('still fails with --fix when a problem needs a person', async () => {
    await inProject(
      {
        '.watermarks-remover.lino': 'allowed-scripts: Latin\n',
        'a.txt': 'hello \u{043C}\u{0438}\u{0440}\n',
      },
      async (root) => {
        const result = await cli(root, ['--fix']);
        expect(result.code).toBe(1);
        expect(result.stdout).toContain('unexpected-script');
        expect(result.stdout).not.toContain(FIX_HINT);
      }
    );
  });

  it('passes with warnings only and hides them with --quiet', async () => {
    await inProject(
      {
        '.watermarks-remover.lino': 'rules\n  zero-width: warn\n',
        'a.txt': DIRTY,
      },
      async (root) => {
        const result = await cli(root, []);
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('warning');
        const quiet = await cli(root, ['--quiet']);
        expect(quiet.code).toBe(0);
        expect(quiet.stdout).toContain('No problems found');
      }
    );
  });

  it('checks only the given paths and honours excludes', async () => {
    await inProject(
      {
        '.watermarks-remover.lino': "files\n  exclude: 'vendor'\n",
        'src/a.txt': 'clean\n',
        'docs/b.txt': DIRTY,
        'vendor/c.txt': DIRTY,
      },
      async (root) => {
        expect((await cli(root, ['src'])).stdout).toBe(
          'No problems found in 1 file.'
        );
        const all = await cli(root, []);
        expect(all.stdout).toContain('docs/b.txt');
        expect(all.stdout).not.toContain('vendor');
        const file = await cli(root, ['docs/b.txt']);
        expect(file.code).toBe(1);
        expect(file.stdout).toContain(`${FIX_HINT} docs/b.txt`);
      }
    );
  });

  it('passes --config on to the fix command', async () => {
    await inProject(
      { 'custom.lino': 'bom: keep\n', 'a.txt': DIRTY },
      async (root) => {
        const result = await cli(root, ['--config', 'custom.lino']);
        expect(result.stdout).toContain(`${FIX_HINT} --config custom.lino`);
      }
    );
  });
});

describe('file discovery', () => {
  it('walks the directory outside git, skipping node_modules', async () => {
    await inProject(
      { 'a.txt': 'x\n', 'node_modules/p/index.js': 'x\n', 'd/e.txt': 'x\n' },
      async (root) => {
        expect(await listFiles(root, [], defaultConfig())).toEqual([
          'a.txt',
          'd/e.txt',
        ]);
      }
    );
  });

  it('uses git to skip ignored files', async () => {
    await inProject(
      {
        '.gitignore': 'build/\n',
        'a.txt': 'x\n',
        'build/out.txt': DIRTY,
      },
      async (root) => {
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        expect(await listFiles(root, [], defaultConfig())).toEqual([
          '.gitignore',
          'a.txt',
        ]);
        expect((await cli(root, [])).code).toBe(0);
      }
    );
  });
});

describe('standard input', () => {
  const input = (text) => async () => new TextEncoder().encode(text);

  it('checks standard input', async () => {
    await inProject({}, async (root) => {
      const result = await cli(root, ['--stdin'], { readStdin: input(DIRTY) });
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('<stdin>:1:6');
    });
  });

  it('prints the fixed text and reports to standard error', async () => {
    await inProject({}, async (root) => {
      const written = [];
      const result = await cli(
        root,
        ['--stdin', '--fix', '--stdin-filename', 'notes.md'],
        { readStdin: input(DIRTY), writeBytes: (bytes) => written.push(bytes) }
      );
      expect(result.code).toBe(0);
      expect(new TextDecoder().decode(written[0])).toBe('Hello world\n');
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('Fixed 1 problem in 1 file.');
    });
  });
});

describe('report formats', () => {
  it('writes GitHub annotations and a step summary on Actions', async () => {
    await inProject({ 'a,b.txt': DIRTY }, async (root) => {
      const summary = join(root, 'summary.md');
      const result = await cli(root, ['a,b.txt'], {
        env: { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: summary },
      });
      expect(result.code).toBe(1);
      expect(result.stdout).toContain(
        '::error file=a%2Cb.txt,line=1,col=6,title=watermarks-remover (zero-width)::'
      );
      expect(result.stdout).toContain(`Run ${FIX_HINT} a,b.txt to fix.`);
      const markdown = read(root, 'summary.md');
      expect(markdown).toContain('## watermarks-remover');
      expect(markdown).toContain('| `a,b.txt:1:6` | zero-width |');
    });
  });

  it('writes JSON', async () => {
    await inProject({ 'a.txt': DIRTY }, async (root) => {
      const result = await cli(root, ['--format', 'json']);
      const report = JSON.parse(result.stdout);
      expect(report.schemaVersion).toBe(1);
      expect(report.tool.name).toBe('watermarks-remover');
      expect(report.summary.errors).toBe(1);
      expect(report.findings[0].rule).toBe('zero-width');
      expect(report.findings[0].line).toBe(1);
    });
  });

  it('writes SARIF to a file', async () => {
    await inProject({ 'a.txt': DIRTY }, async (root) => {
      const result = await cli(root, [
        '--format',
        'sarif',
        '--output',
        'report.sarif',
      ]);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
      const sarif = JSON.parse(read(root, 'report.sarif'));
      expect(sarif.version).toBe('2.1.0');
      const [run] = sarif.runs;
      expect(run.tool.driver.rules.length).toBe(RULES.length);
      expect(run.results[0].ruleId).toBe('zero-width');
      expect(run.results[0].level).toBe('error');
      expect(
        run.results[0].locations[0].physicalLocation.region.startColumn
      ).toBe(6);
    });
  });
});

describe('commands and errors', () => {
  it('prints help, the version and the rules', async () => {
    await inProject({}, async (root) => {
      const help = await cli(root, ['--help']);
      expect(help.code).toBe(0);
      expect(help.stdout).toContain('Usage: watermarks-remover');
      expect((await cli(root, ['-v'])).stdout).toMatch(/^\d+\.\d+\.\d+/);
      const rules = (await cli(root, ['--list-rules'])).stdout;
      for (const rule of RULES) {
        expect(rules).toContain(rule.id);
      }
    });
  });

  it('writes a starter configuration once', async () => {
    await inProject({}, async (root) => {
      expect((await cli(root, ['--init'])).code).toBe(0);
      expect(read(root, '.watermarks-remover.lino')).toContain(
        'encoding: utf-8'
      );
      const again = await cli(root, ['--init']);
      expect(again.code).toBe(2);
      expect(again.stderr).toContain('already exists');
      expect((await cli(root, [])).code).toBe(0);
    });
  });

  it('exits with 2 for usage and configuration errors', async () => {
    await inProject(
      { '.watermarks-remover.lino': 'colour: blue\n', 'a.txt': 'x\n' },
      async (root) => {
        const config = await cli(root, []);
        expect(config.code).toBe(2);
        expect(config.stderr).toContain(
          'Configuration error: .watermarks-remover.lino: unknown setting "colour"'
        );
        const missing = await cli(root, ['--config', 'missing.lino']);
        expect(missing.code).toBe(2);
        expect(missing.stderr).toContain('cannot read');
        expect((await cli(root, ['--format', 'xml'])).code).toBe(2);
        const option = await cli(root, ['--colour']);
        expect(option.code).toBe(2);
        expect(option.stderr).toContain('Usage:');
      }
    );
  });
});
