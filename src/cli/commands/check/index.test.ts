import { describe, expect, it } from 'bun:test';
import { checkCommand } from './index.js';

describe('check command', () => {
  it('has the correct name', () => {
    expect(checkCommand.name()).toBe('check');
  });

  it('registers check subcommands', () => {
    const names = checkCommand.commands.map((command) => command.name());
    expect(names).toContain('list');
    expect(names).toContain('info');
    expect(names).toContain('create');
    expect(names).toContain('update');
    expect(names).toContain('delete');
  });
});
