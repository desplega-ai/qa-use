import { describe, expect, test } from 'bun:test';
import { toSafeFilename } from './strings.js';

describe('toSafeFilename', () => {
  test('converts name to lowercase', () => {
    expect(toSafeFilename('MyTestName')).toBe('mytestname');
  });

  test('replaces non-alphanumeric characters with hyphens', () => {
    expect(toSafeFilename('Test Name With Spaces')).toBe('test-name-with-spaces');
    expect(toSafeFilename('test@special#chars!')).toBe('test-special-chars');
  });

  test('removes leading and trailing hyphens', () => {
    expect(toSafeFilename('!test!')).toBe('test');
    expect(toSafeFilename('---test---')).toBe('test');
  });

  test('uses fallback when name is empty', () => {
    expect(toSafeFilename('')).toBe('unnamed-test');
    expect(toSafeFilename('', 'custom-fallback')).toBe('custom-fallback');
  });

  test('handles complex test names', () => {
    expect(toSafeFilename('Login Flow: Admin User (v2)')).toBe('login-flow-admin-user-v2');
  });
});
