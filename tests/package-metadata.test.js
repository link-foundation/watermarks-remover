import { describe, it, expect } from 'test-anywhere';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { runCli } from '../bin/watermarks-remover.js';
import { itUnless, sandboxed } from './helpers/skip.js';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const lockJson = JSON.parse(readFileSync('package-lock.json', 'utf8'));

function windowsSymlinkSkipReason() {
  if (sandboxed || process.platform !== 'win32') {
    return null;
  }
  const fixture = mkdtempSync(join(tmpdir(), 'symlink-permission-'));
  try {
    symlinkSync(resolve('bin/watermarks-remover.js'), join(fixture, 'bin'));
    return null;
  } catch (error) {
    if (error.code === 'EPERM') {
      return 'Windows file symlinks require developer mode or administrator privileges';
    }
    throw error;
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

const symlinkSkipReason = windowsSymlinkSkipReason();

describe('publishable package metadata', () => {
  it('uses the link-foundation package name', () => {
    expect(packageJson.name).toBe('@link-foundation/watermarks-remover');
    expect(packageJson.publishConfig).toEqual({ access: 'public' });
    expect(lockJson.name).toBe('@link-foundation/watermarks-remover');
    expect(lockJson.packages[''].name).toBe(
      '@link-foundation/watermarks-remover'
    );
  });

  it('defines a globally installable CLI command', () => {
    expect(packageJson.bin).toEqual({
      'watermarks-remover': './bin/watermarks-remover.js',
    });
    expect(existsSync('bin/watermarks-remover.js')).toBe(true);
  });

  it('exposes a browser-safe entry point and a Node.js entry point', () => {
    expect(packageJson.exports['.'].import).toBe('./src/index.js');
    expect(packageJson.exports['./node'].import).toBe('./src/node.js');
    expect(existsSync('src/index.d.ts')).toBe(true);
    expect(existsSync('src/node.d.ts')).toBe(true);
  });

  it('prints the version through the CLI command', async () => {
    const stdout = [];
    const stderr = [];

    expect(
      await runCli(['--version'], {
        stderr: (line) => stderr.push(line),
        stdout: (line) => stdout.push(line),
      })
    ).toBe(0);

    expect(stdout[0].startsWith(packageJson.version)).toBe(true);
    expect(stderr).toEqual([]);
  });

  itUnless(
    sandboxed,
    symlinkSkipReason,
    globalThis.Deno &&
      'Deno resolves relative imports from the bin symlink directory'
  )('runs when invoked through an npm-style bin symlink', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'watermarks-remover-'));
    const linkPath = join(tempRoot, 'watermarks-remover');

    try {
      symlinkSync(resolve('bin/watermarks-remover.js'), linkPath);
      const result = spawnSync(
        process.execPath,
        [...(globalThis.Deno ? ['run', '-A'] : []), linkPath, '--list-rules'],
        { encoding: 'utf8' }
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('zero-width');
      expect(result.stderr).toBe('');
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });

  it('publishes only the package runtime surface', () => {
    expect(packageJson.files).toEqual([
      'bin/',
      'src/',
      'CHANGELOG.md',
      'LICENSE',
      'README.md',
    ]);
  });
});
