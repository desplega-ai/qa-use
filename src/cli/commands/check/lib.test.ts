import { describe, expect, it } from 'bun:test';
import { Readable } from 'node:stream';
import { parseResourceInput } from '../../lib/api-helpers.js';
import {
  buildCheckInputBody,
  parseCheckVariables,
  parseOutputCaptures,
  readJsonObjectFile,
  validateCheckCreateBody,
  validateCheckRetryStrategy,
  validateCheckUpdateBody,
} from './lib.js';

describe('check input helpers', () => {
  it('parses repeatable variables into API variable objects', () => {
    expect(parseCheckVariables(['env=staging', 'claim_id=123'])).toEqual([
      { key: 'env', value: 'staging' },
      { key: 'claim_id', value: 123 },
    ]);
  });

  it('rejects invalid variables', () => {
    expect(() => parseCheckVariables(['missing-separator'])).toThrow('Expected format key=value');
    expect(() => parseCheckVariables(['enabled=true'])).toThrow('string or number');
  });

  it('parses repeatable output captures into API capture objects', () => {
    expect(parseOutputCaptures(['token=$.access_token'])).toEqual([
      { name: 'token', json_path: '$.access_token' },
    ]);
  });

  it('rejects invalid output captures', () => {
    expect(() => parseOutputCaptures(['token'])).toThrow('Expected format name=json_path');
    expect(() => parseOutputCaptures(['token='])).toThrow('json_path cannot be empty');
  });

  it('maps friendly DES-467 flags to exact API body keys', async () => {
    const body = await buildCheckInputBody({
      input: '-',
      stdin: Readable.from(['{"name":"Login","app_config_id":"app-1","config":{"url":"/"}}']),
      alias: 'auth',
      dependsOn: ['dep1'],
      capture: ['token=$.access_token'],
    });

    expect(body).toMatchObject({
      alias: 'auth',
      check_dependency_ids: ['dep1'],
      output_captures: [{ name: 'token', json_path: '$.access_token' }],
    });
  });

  it('merges friendly flags over --input and -F fields', async () => {
    const body = await buildCheckInputBody({
      input: '-',
      stdin: Readable.from(['{"name":"From input","app_config_id":"input-app","config":{}}']),
      field: ['name=From field', 'retry_strategy=none'],
      name: 'From flag',
      retryStrategy: 'simple',
    });

    expect(body.name).toBe('From flag');
    expect(body.retry_strategy).toBe('simple');
    expect(body.app_config_id).toBe('input-app');
  });

  it('reads config and validation JSON object files', async () => {
    const configFile = `/tmp/check-config-${Date.now()}.json`;
    const validationFile = `/tmp/check-validation-${Date.now()}.json`;
    const { writeFile, unlink } = await import('node:fs/promises');
    await writeFile(configFile, JSON.stringify({ method: 'GET' }));
    await writeFile(validationFile, JSON.stringify({ status: 200 }));

    try {
      const body = await buildCheckInputBody({
        config: configFile,
        validation: validationFile,
      });

      expect(body.config).toEqual({ method: 'GET' });
      expect(body.validation).toEqual({ status: 200 });
      await expect(readJsonObjectFile(configFile, 'config')).resolves.toEqual({ method: 'GET' });
    } finally {
      await unlink(configFile).catch(() => {});
      await unlink(validationFile).catch(() => {});
    }
  });

  it('validates create body required fields', () => {
    expect(() => validateCheckCreateBody({ name: 'Login' })).toThrow('app_config_id, config');

    expect(() =>
      validateCheckCreateBody({
        name: 'Login',
        app_config_id: 'app-1',
        config: { method: 'GET' },
      })
    ).not.toThrow();
  });

  it('rejects empty update bodies', () => {
    expect(() => validateCheckUpdateBody({})).toThrow('No fields provided');
  });

  it('validates enum-like retry strategy input', () => {
    expect(validateCheckRetryStrategy('exponential')).toBe('exponential');
    expect(() => validateCheckRetryStrategy('linear')).toThrow('Invalid retry strategy');
  });

  it('lets explicit --input - read a JSON object from stdin without implicit stdin reads', async () => {
    const result = await parseResourceInput({
      input: '-',
      stdin: Readable.from(['{"name":"Login"}']),
    });

    expect(result).toEqual({ name: 'Login' });
    await expect(
      parseResourceInput({
        stdin: Readable.from(['{"name":"Ignored"}']),
      })
    ).resolves.toEqual({});
  });
});
