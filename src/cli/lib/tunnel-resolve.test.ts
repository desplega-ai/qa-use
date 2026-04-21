import { describe, expect, test } from 'bun:test';
import { resolveTunnelFlag, resolveTunnelMode } from './tunnel-resolve.js';

describe('resolveTunnelFlag precedence', () => {
  test('CLI flag "on" wins over config', () => {
    expect(resolveTunnelFlag('on', 'off')).toBe('on');
  });

  test('CLI flag "off" wins over config', () => {
    expect(resolveTunnelFlag('off', 'on')).toBe('off');
  });

  test('config wins when CLI is default (auto)', () => {
    expect(resolveTunnelFlag('auto', 'on')).toBe('on');
    expect(resolveTunnelFlag('auto', 'off')).toBe('off');
  });

  test('config wins when CLI is undefined', () => {
    expect(resolveTunnelFlag(undefined, 'on')).toBe('on');
  });

  test('default to auto when neither set', () => {
    expect(resolveTunnelFlag(undefined, undefined)).toBe('auto');
    expect(resolveTunnelFlag('auto', undefined)).toBe('auto');
  });

  test('config "auto" is treated as an explicit choice over default', () => {
    expect(resolveTunnelFlag(undefined, 'auto')).toBe('auto');
  });
});

describe('resolveTunnelMode decision matrix', () => {
  const REMOTE_API = 'https://api.desplega.ai';
  const LOCAL_API = 'http://localhost:5005';

  describe('mode === "on"', () => {
    test('always returns on regardless of base/API URL', () => {
      expect(resolveTunnelMode('on', 'http://example.com', REMOTE_API)).toBe('on');
      expect(resolveTunnelMode('on', 'http://localhost:3000', REMOTE_API)).toBe('on');
      expect(resolveTunnelMode('on', 'http://localhost:3000', LOCAL_API)).toBe('on');
      expect(resolveTunnelMode('on', undefined, REMOTE_API)).toBe('on');
      expect(resolveTunnelMode('on', undefined, undefined)).toBe('on');
    });
  });

  describe('mode === "off"', () => {
    test('always returns off regardless of base/API URL', () => {
      expect(resolveTunnelMode('off', 'http://localhost:3000', REMOTE_API)).toBe('off');
      expect(resolveTunnelMode('off', 'http://example.com', REMOTE_API)).toBe('off');
      expect(resolveTunnelMode('off', undefined, undefined)).toBe('off');
    });
  });

  describe('mode === "auto"', () => {
    test('returns on for localhost base + remote API (the main case)', () => {
      expect(resolveTunnelMode('auto', 'http://localhost:3000', REMOTE_API)).toBe('on');
      expect(resolveTunnelMode('auto', 'http://127.0.0.1:8080', REMOTE_API)).toBe('on');
      expect(resolveTunnelMode('auto', 'http://foo.localhost', REMOTE_API)).toBe('on');
    });

    test('returns off for localhost base + localhost API (dev mode)', () => {
      expect(resolveTunnelMode('auto', 'http://localhost:3000', LOCAL_API)).toBe('off');
      expect(resolveTunnelMode('auto', 'http://127.0.0.1:3000', 'http://127.0.0.1:5005')).toBe(
        'off'
      );
    });

    test('returns off for remote base (no tunnel needed)', () => {
      expect(resolveTunnelMode('auto', 'https://example.com', REMOTE_API)).toBe('off');
      expect(resolveTunnelMode('auto', 'https://example.com', LOCAL_API)).toBe('off');
    });

    test('returns off when base URL is undefined', () => {
      expect(resolveTunnelMode('auto', undefined, REMOTE_API)).toBe('off');
      expect(resolveTunnelMode('auto', undefined, undefined)).toBe('off');
    });

    test('returns on when API URL is undefined (conservative skip inverted)', () => {
      // Without an API URL we can't be sure it's dev mode; the plan says
      // tunnel when base is localhost unless API is known-localhost.
      expect(resolveTunnelMode('auto', 'http://localhost:3000', undefined)).toBe('on');
    });
  });
});
