import { describe, expect, it } from 'bun:test';
import { formatApiResponseError } from './http.js';

describe('api http error formatting', () => {
  it('uses message from response payload', () => {
    const message = formatApiResponseError(401, 'Unauthorized', {
      message: 'Token verification error',
    });
    expect(message).toBe('HTTP 401 Unauthorized: Token verification error');
  });

  it('falls back to generic status text when payload has no detail', () => {
    const message = formatApiResponseError(500, 'Internal Server Error', {
      foo: 'bar',
    });
    expect(message).toBe('HTTP 500 Internal Server Error');
  });
});
