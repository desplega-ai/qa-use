import { describe, expect, test } from 'bun:test';
import { getPortFromUrl, isLocalhostUrl } from './localhost.js';

describe('isLocalhostUrl', () => {
  test('returns true for localhost', () => {
    expect(isLocalhostUrl('http://localhost:3000')).toBe(true);
    expect(isLocalhostUrl('http://localhost')).toBe(true);
    expect(isLocalhostUrl('https://localhost:8080/path')).toBe(true);
  });

  test('returns true for 127.0.0.1', () => {
    expect(isLocalhostUrl('http://127.0.0.1:5000')).toBe(true);
    expect(isLocalhostUrl('http://127.0.0.1')).toBe(true);
  });

  test('returns true for ::1 (IPv6)', () => {
    expect(isLocalhostUrl('http://[::1]:3000')).toBe(true);
    expect(isLocalhostUrl('http://[::1]')).toBe(true);
  });

  test('returns true for *.localhost', () => {
    expect(isLocalhostUrl('http://foo.localhost:3000')).toBe(true);
    expect(isLocalhostUrl('http://api.localhost')).toBe(true);
  });

  test('returns true for 0.0.0.0', () => {
    expect(isLocalhostUrl('http://0.0.0.0:3000')).toBe(true);
  });

  test('returns false for example.com', () => {
    expect(isLocalhostUrl('https://example.com')).toBe(false);
    expect(isLocalhostUrl('http://example.com:8080')).toBe(false);
  });

  test('returns false for private IPs (not actually localhost)', () => {
    expect(isLocalhostUrl('http://192.168.1.1')).toBe(false);
    expect(isLocalhostUrl('http://10.0.0.1')).toBe(false);
  });

  test('returns false for invalid URLs', () => {
    expect(isLocalhostUrl('not-a-url')).toBe(false);
    expect(isLocalhostUrl('')).toBe(false);
  });
});

describe('getPortFromUrl', () => {
  test('returns explicit port', () => {
    expect(getPortFromUrl('http://localhost:3000')).toBe(3000);
    expect(getPortFromUrl('https://example.com:8443')).toBe(8443);
  });

  test('defaults to 443 for https without port', () => {
    expect(getPortFromUrl('https://example.com')).toBe(443);
  });

  test('defaults to 80 for http without port', () => {
    expect(getPortFromUrl('http://example.com')).toBe(80);
  });

  test('returns 80 for invalid URL', () => {
    expect(getPortFromUrl('not-a-url')).toBe(80);
  });
});
