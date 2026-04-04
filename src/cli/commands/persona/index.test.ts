import { describe, expect, it } from 'bun:test';
import { personaCommand } from './index.js';

describe('persona command', () => {
  it('has the correct name', () => {
    expect(personaCommand.name()).toBe('persona');
  });

  it('registers all expected subcommands', () => {
    const names = personaCommand.commands.map((c) => c.name());
    expect(names).toContain('list');
    expect(names).toContain('info');
    expect(names).toContain('create');
    expect(names).toContain('update');
    expect(names).toContain('delete');
  });
});
