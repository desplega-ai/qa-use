import { describe, expect, it } from 'bun:test';
import { issuesCommand } from './index.js';

describe('issues command', () => {
  it('has correct name', () => {
    expect(issuesCommand.name()).toBe('issues');
  });

  it('registers all expected subcommands', () => {
    const names = issuesCommand.commands.map((c) => c.name());
    expect(names).toContain('list');
    expect(names).toContain('info');
    expect(names).toContain('occurrences');
  });
});
