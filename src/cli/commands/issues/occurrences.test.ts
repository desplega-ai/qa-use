import { describe, expect, it } from 'bun:test';
import { occurrencesCommand } from './occurrences.js';

describe('issues occurrences command', () => {
  it('has required <id> argument', () => {
    expect(occurrencesCommand.registeredArguments[0]?.required).toBe(true);
    expect(occurrencesCommand.registeredArguments[0]?.name()).toBe('id');
  });

  it('has --limit option', () => {
    const opt = occurrencesCommand.options.find((o) => o.long === '--limit');
    expect(opt).toBeDefined();
  });

  it('has --offset option', () => {
    const opt = occurrencesCommand.options.find((o) => o.long === '--offset');
    expect(opt).toBeDefined();
  });

  it('has --json option', () => {
    const opt = occurrencesCommand.options.find((o) => o.long === '--json');
    expect(opt).toBeDefined();
  });
});
