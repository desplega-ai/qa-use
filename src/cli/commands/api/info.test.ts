import { describe, expect, it } from 'bun:test';
import { infoCommand } from './info.js';

describe('api info command', () => {
  it('defines route as a required argument', () => {
    const args = infoCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('route');
    expect(args[0].required).toBe(true);
  });

  it('defines expected options', () => {
    const optionFlags = infoCommand.options.map((option) => option.long);
    expect(optionFlags).toContain('--method');
    expect(optionFlags).toContain('--json');
    expect(optionFlags).toContain('--refresh');
    expect(optionFlags).toContain('--offline');
  });
});
