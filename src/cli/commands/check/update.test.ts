import { describe, expect, it } from 'bun:test';
import { updateCommand } from './update.js';

describe('check update command', () => {
  it('has the correct name', () => {
    expect(updateCommand.name()).toBe('update');
  });

  it('defines check-id as a required argument', () => {
    const args = updateCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('check-id');
    expect(args[0].required).toBe(true);
  });

  it('supports the same mutation helpers as create', () => {
    const optionFlags = updateCommand.options.map((option) => option.long);
    expect(optionFlags).toContain('--input');
    expect(optionFlags).toContain('--field');
    expect(optionFlags).toContain('--depends-on');
    expect(optionFlags).toContain('--alias');
    expect(optionFlags).toContain('--capture');
    expect(optionFlags).toContain('--var');
    expect(optionFlags).toContain('--retry-strategy');
    expect(optionFlags).toContain('--timeout-ms');
    expect(optionFlags).toContain('--json');
  });
});
