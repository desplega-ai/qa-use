import { describe, expect, it } from 'bun:test';
import { apiCommand } from './index.js';

describe('api command', () => {
  it('registers ls as a subcommand', () => {
    const names = apiCommand.commands.map((command) => command.name());
    expect(names).toContain('ls');
  });

  it('uses optional endpoint argument for direct requests', () => {
    expect(apiCommand.registeredArguments[0]?.required).toBe(false);
    expect(apiCommand.registeredArguments[0]?.name()).toBe('endpoint');
  });
});
