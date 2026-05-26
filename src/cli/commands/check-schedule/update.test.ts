import { describe, expect, it } from 'bun:test';
import { updateCommand } from './update.js';

describe('check-schedule update command', () => {
  it('has the correct name', () => {
    expect(updateCommand.name()).toBe('update');
  });

  it('defines schedule-id as a required argument', () => {
    const args = updateCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('schedule-id');
    expect(args[0].required).toBe(true);
  });

  it('supports the same mutation helpers as create', () => {
    const optionFlags = updateCommand.options.map((option) => option.long);
    expect(optionFlags).toContain('--input');
    expect(optionFlags).toContain('--field');
    expect(optionFlags).toContain('--check');
    expect(optionFlags).toContain('--cron');
    expect(optionFlags).toContain('--enabled');
    expect(optionFlags).toContain('--disabled');
    expect(optionFlags).toContain('--failure-strategy');
    expect(optionFlags).toContain('--dependency-condition');
    expect(optionFlags).toContain('--json');
  });
});
