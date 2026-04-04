import { describe, expect, it } from 'bun:test';
import { apiCommand } from './index.js';

describe('api command', () => {
  it('registers all expected subcommands', () => {
    const names = apiCommand.commands.map((command) => command.name());
    expect(names).toContain('ls');
    expect(names).toContain('info');
    expect(names).toContain('examples');
    expect(names).toContain('openapi');
  });

  it('uses optional endpoint argument for direct requests', () => {
    expect(apiCommand.registeredArguments[0]?.required).toBe(false);
    expect(apiCommand.registeredArguments[0]?.name()).toBe('endpoint');
  });
});
