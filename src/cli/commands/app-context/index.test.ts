import { describe, expect, it } from 'bun:test';
import { appContextCommand } from './index.js';

describe('app-context command', () => {
  it('has the correct name', () => {
    expect(appContextCommand.name()).toBe('app-context');
  });

  it('registers all expected subcommands', () => {
    const names = appContextCommand.commands.map((c) => c.name());
    expect(names).toContain('list');
    expect(names).toContain('info');
    expect(names).toContain('create');
    expect(names).toContain('update');
    expect(names).toContain('delete');
  });
});
