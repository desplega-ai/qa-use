import { describe, expect, it } from 'bun:test';
import { inferMethod, requestCommand, resolveOperation } from './request.js';

describe('api request command', () => {
  it('defines endpoint argument', () => {
    expect(requestCommand.registeredArguments[0]?.required).toBe(true);
    expect(requestCommand.registeredArguments[0]?.name()).toBe('endpoint');
  });

  it('defines expected request options', () => {
    const optionFlags = requestCommand.options.map((option) => option.long);
    expect(optionFlags).toContain('--method');
    expect(optionFlags).toContain('--field');
    expect(optionFlags).toContain('--header');
    expect(optionFlags).toContain('--input');
    expect(optionFlags).toContain('--include');
    expect(optionFlags).toContain('--raw');
    expect(optionFlags).toContain('--refresh');
    expect(optionFlags).toContain('--offline');
  });
});

describe('api request operation resolution', () => {
  const operations = {
    'GET /api/v1/tests': {
      key: 'GET /api/v1/tests',
      method: 'GET',
      path: '/api/v1/tests',
      tags: [],
      parameters: [],
      parameterCount: 0,
      requestBodyRequired: false,
    },
    'POST /api/v1/tests-actions/run': {
      key: 'POST /api/v1/tests-actions/run',
      method: 'POST',
      path: '/api/v1/tests-actions/run',
      tags: [],
      parameters: [],
      parameterCount: 0,
      requestBodyRequired: true,
    },
  };

  it('defaults to GET for unknown routes', () => {
    expect(inferMethod(undefined, '/api/v1/unknown-route', operations)).toBe('GET');
    expect(resolveOperation('/api/v1/unknown-route', 'GET', operations)).toBeUndefined();
  });

  it('resolves matching operation by path and method', () => {
    const method = inferMethod(undefined, '/api/v1/tests-actions/run', operations);
    expect(method).toBe('POST');

    const operation = resolveOperation('/api/v1/tests-actions/run', method, operations);
    expect(operation?.key).toBe('POST /api/v1/tests-actions/run');
  });
});
