import { describe, expect, it } from 'bun:test';
import { stepsCommand } from './steps.js';

describe('runs steps command', () => {
  it('has the correct name', () => {
    expect(stepsCommand.name()).toBe('steps');
  });

  it('has required <run-id> argument', () => {
    const args = stepsCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('run-id');
    expect(args[0].required).toBe(true);
  });

  it('defines expected options', () => {
    const optionFlags = stepsCommand.options.map((o) => o.long);
    expect(optionFlags).toContain('--verbose');
    expect(optionFlags).toContain('--json');
  });
});
