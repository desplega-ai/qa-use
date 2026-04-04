import { describe, expect, it } from 'bun:test';
import { deleteCommand } from './delete.js';

describe('app-context delete command', () => {
  it('requires id argument', () => {
    expect(deleteCommand.registeredArguments.length).toBe(1);
    expect(deleteCommand.registeredArguments[0].name()).toBe('id');
    expect(deleteCommand.registeredArguments[0].required).toBe(true);
  });

  it('has --force option', () => {
    const opt = deleteCommand.options.find((o) => o.long === '--force');
    expect(opt).toBeDefined();
  });
});
