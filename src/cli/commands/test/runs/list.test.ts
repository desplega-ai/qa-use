import { describe, expect, it } from 'bun:test';
import { listCommand } from './list.js';

describe('runs list command', () => {
  it('has the correct name', () => {
    expect(listCommand.name()).toBe('list');
  });

  it('has optional [test-name] argument', () => {
    const args = listCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('test-name');
    expect(args[0].required).toBe(false);
  });

  it('defines expected options', () => {
    const optionFlags = listCommand.options.map((o) => o.long);
    expect(optionFlags).toContain('--id');
    expect(optionFlags).toContain('--status');
    expect(optionFlags).toContain('--limit');
    expect(optionFlags).toContain('--offset');
    expect(optionFlags).toContain('--json');
  });
});
