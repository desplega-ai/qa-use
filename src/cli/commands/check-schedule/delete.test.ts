import { describe, expect, it } from 'bun:test';
import { deleteCommand } from './delete.js';

describe('check-schedule delete command', () => {
  it('has the correct name', () => {
    expect(deleteCommand.name()).toBe('delete');
  });

  it('defines schedule-id as a required argument', () => {
    const args = deleteCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('schedule-id');
    expect(args[0].required).toBe(true);
  });

  it('has --force option', () => {
    const opt = deleteCommand.options.find((option) => option.long === '--force');
    expect(opt).toBeDefined();
  });
});
