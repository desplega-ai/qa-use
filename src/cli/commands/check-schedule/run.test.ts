import { describe, expect, it } from 'bun:test';
import { runCommand } from './run.js';

describe('check-schedule run command', () => {
  it('has the correct name', () => {
    expect(runCommand.name()).toBe('run');
  });

  it('defines schedule-id as a required argument', () => {
    const args = runCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('schedule-id');
    expect(args[0].required).toBe(true);
  });

  it('documents schedule variables and JSON output', () => {
    const optionFlags = runCommand.options.map((option) => option.long);
    expect(optionFlags).toContain('--var');
    expect(optionFlags).toContain('--json');
    expect(runCommand.description()).toContain('remote schedule chain');
  });
});
