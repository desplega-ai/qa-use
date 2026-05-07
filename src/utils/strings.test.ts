import { describe, expect, test } from 'bun:test';
import { isUuid, toSafeFilename, toUniqueTestFilename } from './strings.js';

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

describe('toUniqueTestFilename', () => {
  test('appends 8-char hex prefix from UUID', () => {
    expect(toUniqueTestFilename('Verify EASM', '275282ed-d6d8-4f16-b5c0-2645ab968789')).toBe(
      'verify-easm-275282ed'
    );
  });

  test('disambiguates same-named tests', () => {
    const a = toUniqueTestFilename('Same Name', '275282ed-d6d8-4f16-b5c0-2645ab968789');
    const b = toUniqueTestFilename('Same Name', '64b70f65-5774-47cf-b236-616f5bb17cbb');
    expect(a).not.toBe(b);
    expect(a).toBe('same-name-275282ed');
    expect(b).toBe('same-name-64b70f65');
  });

  test('falls back to safe-name when id is missing', () => {
    expect(toUniqueTestFilename('No ID', null)).toBe('no-id');
    expect(toUniqueTestFilename('No ID', undefined)).toBe('no-id');
    expect(toUniqueTestFilename('No ID', '')).toBe('no-id');
  });

  test('handles ids without hyphens', () => {
    expect(toUniqueTestFilename('Compact', '275282edd6d84f16b5c02645ab968789')).toBe(
      'compact-275282ed'
    );
  });

  test('uses fallback slug when name is empty', () => {
    expect(toUniqueTestFilename('', '275282ed-d6d8-4f16-b5c0-2645ab968789')).toBe(
      'unnamed-test-275282ed'
    );
  });
});

describe('isUuid', () => {
  test('accepts canonical hyphenated UUIDs', () => {
    expect(isUuid('275282ed-d6d8-4f16-b5c0-2645ab968789')).toBe(true);
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(true);
  });

  test('is case-insensitive', () => {
    expect(isUuid('275282ED-D6D8-4F16-B5C0-2645AB968789')).toBe(true);
  });

  test('rejects non-UUID values', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('Verify EASM')).toBe(false);
    expect(isUuid('275282edd6d84f164b5c02645ab968789')).toBe(false); // no hyphens
    expect(isUuid('275282ed-d6d8-4f16-b5c0')).toBe(false); // truncated
    expect(isUuid('')).toBe(false);
  });
});
