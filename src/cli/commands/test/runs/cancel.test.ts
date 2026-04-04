import { describe, expect, it } from 'bun:test';
import { cancelCommand } from './cancel.js';

describe('runs cancel command', () => {
  it('has the correct name', () => {
    expect(cancelCommand.name()).toBe('cancel');
  });

  it('has required <run-id> argument', () => {
    const args = cancelCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('run-id');
    expect(args[0].required).toBe(true);
  });

  it('defines expected options', () => {
    const optionFlags = cancelCommand.options.map((o) => o.long);
    expect(optionFlags).toContain('--force');
  });
});
