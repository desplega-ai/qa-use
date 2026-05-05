import { describe, expect, it } from 'bun:test';
import { resolveVarsTarget } from './test-vars.js';

describe('resolveVarsTarget', () => {
  it('returns file when only file is provided', () => {
    expect(resolveVarsTarget({ file: 'foo.yaml' })).toEqual({ kind: 'file', path: 'foo.yaml' });
  });

  it('returns id when only --id is provided (full UUID)', () => {
    const id = '12345678-1234-1234-1234-123456789abc';
    expect(resolveVarsTarget({ id })).toEqual({ kind: 'id', uuid: id });
  });

  it('throws when both are provided', () => {
    expect(() =>
      resolveVarsTarget({ file: 'foo.yaml', id: '12345678-1234-1234-1234-123456789abc' })
    ).toThrow(/both/i);
  });

  it('throws when neither is provided', () => {
    expect(() => resolveVarsTarget({})).toThrow(/missing target/i);
  });

  it('throws on partial / invalid UUID', () => {
    expect(() => resolveVarsTarget({ id: 'deadbeef' })).toThrow(/full UUID/i);
    expect(() => resolveVarsTarget({ id: '1234' })).toThrow(/full UUID/i);
  });
});
