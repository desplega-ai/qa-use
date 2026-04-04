import { describe, expect, it } from 'bun:test';
import { suiteCommand } from './index.js';

describe('suite command', () => {
  it('has correct name', () => {
    expect(suiteCommand.name()).toBe('suite');
  });

  it('registers all expected subcommands', () => {
    const names = suiteCommand.commands.map((c) => c.name());
    expect(names).toContain('list');
    expect(names).toContain('info');
    expect(names).toContain('create');
    expect(names).toContain('update');
    expect(names).toContain('delete');
    expect(names).toContain('run');
  });
});
