import { describe, expect, test } from 'bun:test';
import {
  classifyTunnelFailure,
  TunnelAuthError,
  TunnelError,
  TunnelNetworkError,
  TunnelQuotaError,
  TunnelUnknownError,
} from './errors.js';

describe('TunnelError', () => {
  test('base class carries target + provider + cause', () => {
    const cause = new Error('boom');
    const err = new TunnelError('msg', {
      target: 'http://localhost:3000',
      provider: 'localtunnel',
      cause,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.target).toBe('http://localhost:3000');
    expect(err.provider).toBe('localtunnel');
    expect(err.cause).toBe(cause);
  });

  test('provider defaults to "localtunnel"', () => {
    const err = new TunnelError('msg', { target: 'x' });
    expect(err.provider).toBe('localtunnel');
  });
});

describe('classifyTunnelFailure', () => {
  test('classifies Node errno codes as network errors', () => {
    const nodeErr = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    const out = classifyTunnelFailure(nodeErr);
    expect(out).toBeInstanceOf(TunnelNetworkError);
  });

  test('classifies ETIMEDOUT as network', () => {
    const err = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
    expect(classifyTunnelFailure(err)).toBeInstanceOf(TunnelNetworkError);
  });

  test('classifies ENOTFOUND as network', () => {
    const err = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
    expect(classifyTunnelFailure(err)).toBeInstanceOf(TunnelNetworkError);
  });

  test('classifies message-based timeout text as network', () => {
    const err = new Error('Connection timed out after 5s');
    expect(classifyTunnelFailure(err)).toBeInstanceOf(TunnelNetworkError);
  });

  test('classifies HTTP 401 as auth error', () => {
    const err = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    expect(classifyTunnelFailure(err)).toBeInstanceOf(TunnelAuthError);
  });

  test('classifies HTTP 403 as auth error', () => {
    const err = Object.assign(new Error('Forbidden'), { statusCode: 403 });
    expect(classifyTunnelFailure(err)).toBeInstanceOf(TunnelAuthError);
  });

  test('classifies "unauthorized" message as auth error', () => {
    const err = new Error('Request rejected: unauthorized');
    expect(classifyTunnelFailure(err)).toBeInstanceOf(TunnelAuthError);
  });

  test('classifies HTTP 429 as quota error', () => {
    const err = Object.assign(new Error('Too Many Requests'), { statusCode: 429 });
    expect(classifyTunnelFailure(err)).toBeInstanceOf(TunnelQuotaError);
  });

  test('classifies "rate limit" message as quota error', () => {
    const err = new Error('rate limit exceeded');
    expect(classifyTunnelFailure(err)).toBeInstanceOf(TunnelQuotaError);
  });

  test('classifies "subdomain already in use" as quota error', () => {
    const err = new Error('subdomain qa-use-foo is already in use');
    expect(classifyTunnelFailure(err)).toBeInstanceOf(TunnelQuotaError);
  });

  test('classifies nested response.status', () => {
    const err = { message: 'boom', response: { status: 401 } };
    expect(classifyTunnelFailure(err)).toBeInstanceOf(TunnelAuthError);
  });

  test('falls back to TunnelUnknownError on unrecognised shape', () => {
    const err = new Error('something exploded');
    expect(classifyTunnelFailure(err)).toBeInstanceOf(TunnelUnknownError);
  });

  test('preserves target and cause in the returned error', () => {
    const cause = new Error('root');
    const out = classifyTunnelFailure(cause, { target: 'http://localhost:3000' });
    expect(out.target).toBe('http://localhost:3000');
    expect(out.cause).toBe(cause);
  });

  test('handles non-Error values', () => {
    expect(classifyTunnelFailure('bare string')).toBeInstanceOf(TunnelUnknownError);
    expect(classifyTunnelFailure(undefined)).toBeInstanceOf(TunnelUnknownError);
    expect(classifyTunnelFailure(null)).toBeInstanceOf(TunnelUnknownError);
  });
});
