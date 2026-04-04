import { describe, expect, it } from 'bun:test';
import { usageCommand } from './usage.js';

describe('usage command', () => {
  it('has correct name', () => {
    expect(usageCommand.name()).toBe('usage');
  });

  it('has --detailed option', () => {
    const opt = usageCommand.options.find((o) => o.long === '--detailed');
    expect(opt).toBeDefined();
  });

  it('has --json option', () => {
    const opt = usageCommand.options.find((o) => o.long === '--json');
    expect(opt).toBeDefined();
  });

  it('has --limit option', () => {
    const opt = usageCommand.options.find((o) => o.long === '--limit');
    expect(opt).toBeDefined();
  });

  it('has --offset option', () => {
    const opt = usageCommand.options.find((o) => o.long === '--offset');
    expect(opt).toBeDefined();
  });
});
