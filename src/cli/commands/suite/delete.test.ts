import { describe, expect, it } from 'bun:test';
import { deleteCommand } from './delete.js';

describe('suite delete command', () => {
  it('has correct name', () => {
    expect(deleteCommand.name()).toBe('delete');
  });

  it('has required <id> argument', () => {
    expect(deleteCommand.registeredArguments[0]?.required).toBe(true);
    expect(deleteCommand.registeredArguments[0]?.name()).toBe('id');
  });

  it('has --force option', () => {
    const opt = deleteCommand.options.find((o) => o.long === '--force');
    expect(opt).toBeDefined();
  });
});
