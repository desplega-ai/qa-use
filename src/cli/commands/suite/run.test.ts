import { describe, expect, it } from 'bun:test';
import { runCommand } from './run.js';

describe('suite run command', () => {
  it('has correct name', () => {
    expect(runCommand.name()).toBe('run');
  });

  it('has required <id> argument', () => {
    expect(runCommand.registeredArguments[0]?.required).toBe(true);
    expect(runCommand.registeredArguments[0]?.name()).toBe('id');
  });

  it('has --json option', () => {
    const opt = runCommand.options.find((o) => o.long === '--json');
    expect(opt).toBeDefined();
  });
});
