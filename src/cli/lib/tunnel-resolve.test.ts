import { describe, expect, test } from 'bun:test';
import { resolveTunnelFlag } from './tunnel-resolve.js';

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
