import { describe, expect, it } from 'bun:test';
import { appConfigCommand } from './index.js';

describe('app-config command', () => {
  it('has the correct name', () => {
    expect(appConfigCommand.name()).toBe('app-config');
  });

  it('registers all expected subcommands', () => {
    const names = appConfigCommand.commands.map((c) => c.name());
    expect(names).toContain('list');
    expect(names).toContain('info');
    expect(names).toContain('create');
    expect(names).toContain('update');
    expect(names).toContain('delete');
  });
});
