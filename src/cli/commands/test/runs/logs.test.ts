import { describe, expect, it } from 'bun:test';
import { logsCommand } from './logs.js';

describe('runs logs command', () => {
  it('has the correct name', () => {
    expect(logsCommand.name()).toBe('logs');
  });

  it('has required <run-id> argument', () => {
    const args = logsCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('run-id');
    expect(args[0].required).toBe(true);
  });

  it('defines expected options', () => {
    const optionFlags = logsCommand.options.map((o) => o.long);
    expect(optionFlags).toContain('--type');
    expect(optionFlags).toContain('--json');
  });

  it('has console as default for --type option', () => {
    const typeOption = logsCommand.options.find((o) => o.long === '--type');
    expect(typeOption?.defaultValue).toBe('console');
  });
});
