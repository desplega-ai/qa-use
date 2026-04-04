import { describe, expect, it } from 'bun:test';
import { infoCommand } from './info.js';

describe('runs info command', () => {
  it('has the correct name', () => {
    expect(infoCommand.name()).toBe('info');
  });

  it('has required <run-id> argument', () => {
    const args = infoCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('run-id');
    expect(args[0].required).toBe(true);
  });

  it('defines expected options', () => {
    const optionFlags = infoCommand.options.map((o) => o.long);
    expect(optionFlags).toContain('--json');
  });
});
