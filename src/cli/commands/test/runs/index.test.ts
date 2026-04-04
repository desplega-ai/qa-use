import { describe, expect, it } from 'bun:test';
import { runsCommand } from './index.js';

describe('runs command group', () => {
  it('has the correct name', () => {
    expect(runsCommand.name()).toBe('runs');
  });

  it('registers all expected subcommands', () => {
    const names = runsCommand.commands.map((c) => c.name());
    expect(names).toContain('list');
    expect(names).toContain('info');
    expect(names).toContain('logs');
    expect(names).toContain('steps');
    expect(names).toContain('cancel');
  });
});
