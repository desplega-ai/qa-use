import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { assertHeadlessAllowed, isForceHeadless, resolveForcedHeadless } from './force-headless.js';
import { clearConfigCache } from './index.js';

const ENV_KEY = 'QA_USE_FORCE_HEADLESS';

let saved: string | undefined;

beforeEach(() => {
  saved = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
  clearConfigCache();
});

afterEach(() => {
  if (saved === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = saved;
  }
  clearConfigCache();
});

describe('isForceHeadless', () => {
  test('false when unset', () => {
    expect(isForceHeadless()).toBe(false);
  });

  test('true for truthy values (case/whitespace insensitive)', () => {
    for (const v of ['1', 'true', 'TRUE', ' yes ', 'on', 'On']) {
      process.env[ENV_KEY] = v;
      expect(isForceHeadless()).toBe(true);
    }
  });

  test('false for falsy / empty values', () => {
    for (const v of ['0', 'false', 'no', 'off', '']) {
      process.env[ENV_KEY] = v;
      expect(isForceHeadless()).toBe(false);
    }
  });
});

describe('assertHeadlessAllowed', () => {
  test('no-op when force is off', () => {
    expect(() => assertHeadlessAllowed(false, '--no-headless flag')).not.toThrow();
  });

  test('no-op when requested is true or undefined', () => {
    process.env[ENV_KEY] = '1';
    expect(() => assertHeadlessAllowed(true, 'src')).not.toThrow();
    expect(() => assertHeadlessAllowed(undefined, 'src')).not.toThrow();
  });

  test('throws when force is on and requested is false', () => {
    process.env[ENV_KEY] = '1';
    expect(() => assertHeadlessAllowed(false, '--no-headless flag')).toThrow(
      /QA_USE_FORCE_HEADLESS/
    );
    expect(() => assertHeadlessAllowed(false, '--no-headless flag')).toThrow(/--no-headless flag/);
  });
});

describe('resolveForcedHeadless', () => {
  test('passthrough when force is off', () => {
    expect(resolveForcedHeadless(false)).toBe(false);
    expect(resolveForcedHeadless(true)).toBe(true);
    expect(resolveForcedHeadless(undefined)).toBeUndefined();
  });

  test('coerces undefined to true when force is on', () => {
    process.env[ENV_KEY] = 'true';
    expect(resolveForcedHeadless(undefined)).toBe(true);
    expect(resolveForcedHeadless(true)).toBe(true);
  });

  test('throws on explicit false when force is on', () => {
    process.env[ENV_KEY] = '1';
    expect(() => resolveForcedHeadless(false, 'startBrowser options')).toThrow(
      /startBrowser options/
    );
  });
});
