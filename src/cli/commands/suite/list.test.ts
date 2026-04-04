import { describe, expect, it } from 'bun:test';
import { listCommand } from './list.js';

describe('suite list command', () => {
  it('has correct name', () => {
    expect(listCommand.name()).toBe('list');
  });

  it('has --limit option', () => {
    const opt = listCommand.options.find((o) => o.long === '--limit');
    expect(opt).toBeDefined();
  });

  it('has --offset option', () => {
    const opt = listCommand.options.find((o) => o.long === '--offset');
    expect(opt).toBeDefined();
  });

  it('has --json option', () => {
    const opt = listCommand.options.find((o) => o.long === '--json');
    expect(opt).toBeDefined();
  });
});
