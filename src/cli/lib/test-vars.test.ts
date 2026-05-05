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
  verifySetMutation,
  verifyUnsetMutation,
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

describe('verifySetMutation', () => {
  it('returns null when simple-form value matches', () => {
    expect(verifySetMutation({ foo: 'bar' }, 'foo', 'bar')).toBeNull();
  });

  it('flags missing key', () => {
    const err = verifySetMutation({}, 'foo', 'bar');
    expect(err).toMatch(/missing/i);
    expect(err).toContain("'foo'");
  });

  it('flags value mismatch', () => {
    const err = verifySetMutation({ foo: 'wrong' }, 'foo', 'bar');
    expect(err).toMatch(/diverged/i);
    expect(err).toContain("'value'");
  });

  it('tolerates server normalizing simple form to full form (extra fields ok)', () => {
    const actual = {
      foo: { value: 'bar', type: 'custom' as const, is_sensitive: false },
    };
    expect(verifySetMutation(actual, 'foo', 'bar')).toBeNull();
  });

  it('asserts requested type/lifetime/context/is_sensitive on full form', () => {
    const expected = {
      value: 'https://x',
      type: 'url' as const,
      lifetime: 'test' as const,
      context: 'test' as const,
      is_sensitive: false,
    };
    const matching = { site: { ...expected } };
    expect(verifySetMutation(matching, 'site', expected)).toBeNull();

    const wrongType = { site: { ...expected, type: 'custom' as const } };
    const err = verifySetMutation(wrongType, 'site', expected);
    expect(err).toContain("'type'");
  });

  it('flags is_sensitive divergence (false-positive guard)', () => {
    const expected = { value: 'hunter2', is_sensitive: true };
    const actual = { password: { value: 'hunter2', is_sensitive: false } };
    const err = verifySetMutation(actual, 'password', expected);
    expect(err).toContain("'is_sensitive'");
  });
});

describe('verifyUnsetMutation', () => {
  it('returns null when key is absent', () => {
    expect(verifyUnsetMutation({}, 'gone')).toBeNull();
    expect(verifyUnsetMutation({ other: 'x' }, 'gone')).toBeNull();
  });

  it('flags key still present (catches conflict/unchanged false-positive)', () => {
    const err = verifyUnsetMutation({ stuck: 'value' }, 'stuck');
    expect(err).toMatch(/still present/i);
    expect(err).toContain("'stuck'");
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
