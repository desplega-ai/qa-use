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
  const dir = mkdtempSync(join(tmpdir(), 'qa-use-vars-set-'));
  const path = join(dir, 'test.yaml');
  writeFileSync(path, content);
  return path;
}

describe('vars set', () => {
  it('writes simple form when only --key/--value are passed', () => {
    const path = writeFixture('name: t\nsteps: []\n');
    const { status } = runCli(['test', 'vars', 'set', path, '--key', 'foo', '--value', 'bar']);
    expect(status).toBe(0);
    const content = readFileSync(path, 'utf-8');
    expect(content).toMatch(/^\s+foo: bar$/m);
    expect(content).toContain('variables:');
  });

  it('upgrades to full form when --type is passed', () => {
    const path = writeFixture('name: t\nsteps: []\n');
    const { status } = runCli([
      'test',
      'vars',
      'set',
      path,
      '--key',
      'site',
      '--value',
      'https://x',
      '--type',
      'url',
    ]);
    expect(status).toBe(0);
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('site:');
    expect(content).toMatch(/value: https:\/\/x/);
    expect(content).toMatch(/type: url/);
  });

  it('preserves comments on neighbour keys', () => {
    const path = writeFixture(
      [
        'name: t',
        'steps: []',
        'variables:',
        '  # leading comment for foo',
        '  foo: bar',
        '  baz: qux',
        '',
      ].join('\n')
    );
    const { status } = runCli(['test', 'vars', 'set', path, '--key', 'baz', '--value', 'newval']);
    expect(status).toBe(0);
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('# leading comment for foo');
    expect(content).toContain('baz: newval');
  });

  it('preserves stored value when --sensitive is set without --value on existing sensitive key', () => {
    const path = writeFixture(
      [
        'name: t',
        'steps: []',
        'variables:',
        '  password:',
        '    value: hunter2',
        '    type: password',
        '    is_sensitive: true',
        '',
      ].join('\n')
    );
    const { status } = runCli(['test', 'vars', 'set', path, '--key', 'password', '--sensitive']);
    expect(status).toBe(0);
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('value: hunter2');
    expect(content).toContain('is_sensitive: true');
  });

  it('rejects --sensitive without --value on a new key', () => {
    const path = writeFixture('name: t\nsteps: []\n');
    const { status, stdout, stderr } = runCli([
      'test',
      'vars',
      'set',
      path,
      '--key',
      'newkey',
      '--sensitive',
    ]);
    expect(status).not.toBe(0);
    expect(`${stdout}${stderr}`).toMatch(/sensitive/i);
  });

  it('rejects an unknown --type with a stderr message naming the field', () => {
    const path = writeFixture('name: t\nsteps: []\n');
    const { status, stdout, stderr } = runCli([
      'test',
      'vars',
      'set',
      path,
      '--key',
      'x',
      '--type',
      'bogus',
      '--value',
      'y',
    ]);
    expect(status).not.toBe(0);
    expect(`${stdout}${stderr}`).toContain('--type');
  });
});
