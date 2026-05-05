import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../../../../..');

function runCli(args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('bun', ['run', 'cli', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, BUN_TMPDIR: process.env.BUN_TMPDIR ?? '/tmp/bun-tmp' },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

function writeFixture(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'qa-use-vars-unset-'));
  const path = join(dir, 'test.yaml');
  writeFileSync(path, content);
  return path;
}

describe('vars unset', () => {
  it('exits 0 and leaves the file unchanged when the key is absent', () => {
    const original = ['name: t', 'steps: []', 'variables:', '  foo: bar', ''].join('\n');
    const path = writeFixture(original);
    const { status } = runCli(['test', 'vars', 'unset', path, '--key', 'nope']);
    expect(status).toBe(0);
    expect(readFileSync(path, 'utf-8')).toBe(original);
  });

  it('removes the key but keeps the variables block when other keys remain', () => {
    const path = writeFixture(
      ['name: t', 'steps: []', 'variables:', '  foo: bar', '  baz: qux', ''].join('\n')
    );
    const { status } = runCli(['test', 'vars', 'unset', path, '--key', 'foo']);
    expect(status).toBe(0);
    const content = readFileSync(path, 'utf-8');
    expect(content).not.toMatch(/^\s+foo:/m);
    expect(content).toMatch(/^\s+baz: qux$/m);
    expect(content).toMatch(/^variables:/m);
  });

  it('removes the entire variables block when the last key is unset', () => {
    const path = writeFixture(['name: t', 'steps: []', 'variables:', '  only: x', ''].join('\n'));
    const { status } = runCli(['test', 'vars', 'unset', path, '--key', 'only']);
    expect(status).toBe(0);
    const content = readFileSync(path, 'utf-8');
    expect(content).not.toMatch(/^variables:/m);
  });
});
