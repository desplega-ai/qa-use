import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import {
  collectFields,
  paginationQuery,
  parseResourceInput,
  requireApiKey,
} from './api-helpers.js';

// ---------------------------------------------------------------------------
// requireApiKey
// ---------------------------------------------------------------------------

describe('requireApiKey', () => {
  let exitSpy: ReturnType<typeof spyOn>;
  let logSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    exitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('should pass when api_key is present', () => {
    const config = { api_key: 'test-key' };
    expect(() => requireApiKey(config)).not.toThrow();
  });

  it('should exit when api_key is missing', () => {
    const config = {};
    expect(() => requireApiKey(config)).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit when api_key is undefined', () => {
    const config = { api_key: undefined };
    expect(() => requireApiKey(config)).toThrow('process.exit');
  });
});

// ---------------------------------------------------------------------------
// paginationQuery
// ---------------------------------------------------------------------------

describe('paginationQuery', () => {
  it('should return empty object when no options', () => {
    expect(paginationQuery({})).toEqual({});
  });

  it('should include limit when provided', () => {
    expect(paginationQuery({ limit: '10' })).toEqual({ limit: '10' });
  });

  it('should include offset when provided', () => {
    expect(paginationQuery({ offset: '20' })).toEqual({ offset: '20' });
  });

  it('should include both limit and offset', () => {
    expect(paginationQuery({ limit: '10', offset: '20' })).toEqual({
      limit: '10',
      offset: '20',
    });
  });

  it('should not include undefined values', () => {
    const result = paginationQuery({ limit: undefined, offset: undefined });
    expect(result).toEqual({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// collectFields
// ---------------------------------------------------------------------------

describe('collectFields', () => {
  it('should accumulate values into an array', () => {
    const arr: string[] = [];
    collectFields('a=1', arr);
    collectFields('b=2', arr);
    expect(arr).toEqual(['a=1', 'b=2']);
  });

  it('should return the same array reference', () => {
    const arr: string[] = [];
    const result = collectFields('x=y', arr);
    expect(result).toBe(arr);
  });
});

// ---------------------------------------------------------------------------
// parseResourceInput
// ---------------------------------------------------------------------------

describe('parseResourceInput', () => {
  it('should return empty object when no options', async () => {
    const result = await parseResourceInput({});
    expect(result).toEqual({});
  });

  it('should parse -F fields as key=value', async () => {
    const result = await parseResourceInput({
      field: ['name=test', 'count=5'],
    });
    expect(result).toEqual({ name: 'test', count: 5 });
  });

  it('should treat JSON-parseable values as JSON', async () => {
    const result = await parseResourceInput({
      field: ['ids=["a","b"]', 'active=true', 'count=42'],
    });
    expect(result).toEqual({
      ids: ['a', 'b'],
      active: true,
      count: 42,
    });
  });

  it('should keep plain strings as strings', async () => {
    const result = await parseResourceInput({
      field: ['name=hello world'],
    });
    expect(result).toEqual({ name: 'hello world' });
  });

  it('should throw on invalid field format', async () => {
    await expect(parseResourceInput({ field: ['bad-field'] })).rejects.toThrow('Invalid field');
  });

  it('should throw on field with empty key', async () => {
    await expect(parseResourceInput({ field: ['=value'] })).rejects.toThrow('Invalid field');
  });

  it('should read --input JSON file', async () => {
    const tmpFile = `/tmp/api-helpers-test-${Date.now()}.json`;
    const { writeFile, unlink } = await import('node:fs/promises');
    await writeFile(tmpFile, JSON.stringify({ foo: 'bar', num: 1 }));
    try {
      const result = await parseResourceInput({ input: tmpFile });
      expect(result).toEqual({ foo: 'bar', num: 1 });
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  });

  it('should merge -F fields over --input file', async () => {
    const tmpFile = `/tmp/api-helpers-test-merge-${Date.now()}.json`;
    const { writeFile, unlink } = await import('node:fs/promises');
    await writeFile(tmpFile, JSON.stringify({ foo: 'bar', keep: true }));
    try {
      const result = await parseResourceInput({
        input: tmpFile,
        field: ['foo=overridden'],
      });
      expect(result).toEqual({ foo: 'overridden', keep: true });
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  });

  it('should throw on invalid JSON input file', async () => {
    const tmpFile = `/tmp/api-helpers-test-bad-${Date.now()}.json`;
    const { writeFile, unlink } = await import('node:fs/promises');
    await writeFile(tmpFile, 'not valid json');
    try {
      await expect(parseResourceInput({ input: tmpFile })).rejects.toThrow(
        'Failed to parse JSON input file'
      );
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  });

  it('should throw when input file contains a non-object JSON', async () => {
    const tmpFile = `/tmp/api-helpers-test-arr-${Date.now()}.json`;
    const { writeFile, unlink } = await import('node:fs/promises');
    await writeFile(tmpFile, JSON.stringify([1, 2, 3]));
    try {
      await expect(parseResourceInput({ input: tmpFile })).rejects.toThrow(
        'must contain a JSON object'
      );
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  });
});
