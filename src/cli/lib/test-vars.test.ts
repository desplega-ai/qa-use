import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getNormalizedEntry,
  maskValue,
  readVarsFromYamlFile,
  TEST_VARIABLE_CONTEXTS,
  TEST_VARIABLE_LIFETIMES,
  TEST_VARIABLE_TYPES,
} from './test-vars.js';

describe('getNormalizedEntry', () => {
  it('coerces simple-form string to full form', () => {
    expect(getNormalizedEntry('hello')).toEqual({ value: 'hello', is_sensitive: false });
  });

  it('coerces simple-form number to full form', () => {
    expect(getNormalizedEntry(42)).toEqual({ value: 42, is_sensitive: false });
  });

  it('passes full-form entries through', () => {
    const entry = { value: 'abc', type: 'url' as const, is_sensitive: false };
    expect(getNormalizedEntry(entry)).toBe(entry);
  });
});

describe('maskValue', () => {
  it('returns simple value as string', () => {
    expect(maskValue('foo')).toBe('foo');
    expect(maskValue(7)).toBe('7');
  });

  it('returns the value of a non-sensitive full-form entry', () => {
    expect(maskValue({ value: 'public' })).toBe('public');
  });

  it('masks sensitive full-form entries', () => {
    expect(maskValue({ value: 'hunter2', is_sensitive: true })).toBe('****');
  });

  it('does not truncate — caller owns truncation', () => {
    const long = 'x'.repeat(120);
    expect(maskValue(long).length).toBe(120);
  });
});

describe('readVarsFromYamlFile', () => {
  it('returns empty vars when file has no variables block', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qa-use-test-vars-'));
    const path = join(dir, 'no-vars.yaml');
    writeFileSync(path, 'name: blank\nsteps: []\n');
    const { doc, vars } = await readVarsFromYamlFile(path);
    expect(doc).toBeDefined();
    expect(vars).toEqual({});
  });

  it('parses simple + full-form variables', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qa-use-test-vars-'));
    const path = join(dir, 'with-vars.yaml');
    writeFileSync(
      path,
      'name: test\nvariables:\n  foo: bar\n  url:\n    value: https://x\n    type: url\nsteps: []\n'
    );
    const { vars } = await readVarsFromYamlFile(path);
    expect(vars.foo).toBe('bar');
    expect(typeof vars.url).toBe('object');
    expect((vars.url as { value: string }).value).toBe('https://x');
  });
});

describe('runtime enum mirrors', () => {
  it('TEST_VARIABLE_TYPES includes the 20 known types', () => {
    expect(TEST_VARIABLE_TYPES.length).toBe(20);
    expect(TEST_VARIABLE_TYPES).toContain('custom');
    expect(TEST_VARIABLE_TYPES).toContain('password');
    expect(TEST_VARIABLE_TYPES).toContain('slug');
  });

  it('TEST_VARIABLE_LIFETIMES covers all/test/suite', () => {
    expect([...TEST_VARIABLE_LIFETIMES].sort()).toEqual(['all', 'suite', 'test']);
  });

  it('TEST_VARIABLE_CONTEXTS covers test/suite/persona/app_config/global', () => {
    expect([...TEST_VARIABLE_CONTEXTS].sort()).toEqual([
      'app_config',
      'global',
      'persona',
      'suite',
      'test',
    ]);
  });
});
