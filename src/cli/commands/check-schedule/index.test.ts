import { describe, expect, it } from 'bun:test';
import { checkScheduleCommand } from './index.js';

describe('check-schedule command', () => {
  it('has the correct name', () => {
    expect(checkScheduleCommand.name()).toBe('check-schedule');
  });

  it('registers schedule subcommands', () => {
    const names = checkScheduleCommand.commands.map((command) => command.name());
    expect(names).toContain('list');
    expect(names).toContain('info');
    expect(names).toContain('create');
    expect(names).toContain('update');
    expect(names).toContain('delete');
    expect(names).toContain('run');
  });
});
