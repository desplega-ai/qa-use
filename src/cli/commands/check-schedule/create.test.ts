import { describe, expect, it } from 'bun:test';
import { createCommand } from './create.js';

describe('check-schedule create command', () => {
  it('has the correct name', () => {
    expect(createCommand.name()).toBe('create');
  });

  it('defines friendly schedule input options', () => {
    const optionFlags = createCommand.options.map((option) => option.long);
    expect(optionFlags).toContain('--name');
    expect(optionFlags).toContain('--description');
    expect(optionFlags).toContain('--app-config');
    expect(optionFlags).toContain('--check');
    expect(optionFlags).toContain('--cron');
    expect(optionFlags).toContain('--timezone');
    expect(optionFlags).toContain('--enabled');
    expect(optionFlags).toContain('--disabled');
    expect(optionFlags).toContain('--failure-strategy');
    expect(optionFlags).toContain('--dependency-condition');
    expect(optionFlags).toContain('--input');
    expect(optionFlags).toContain('--field');
    expect(optionFlags).toContain('--json');
  });
});
