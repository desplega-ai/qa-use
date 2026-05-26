import { describe, expect, it } from 'bun:test';
import { createCommand } from './create.js';

describe('check create command', () => {
  it('has the correct name', () => {
    expect(createCommand.name()).toBe('create');
  });

  it('defines friendly check input options', () => {
    const optionFlags = createCommand.options.map((option) => option.long);
    expect(optionFlags).toContain('--name');
    expect(optionFlags).toContain('--app-config');
    expect(optionFlags).toContain('--config');
    expect(optionFlags).toContain('--validation');
    expect(optionFlags).toContain('--input');
    expect(optionFlags).toContain('--field');
    expect(optionFlags).toContain('--depends-on');
    expect(optionFlags).toContain('--alias');
    expect(optionFlags).toContain('--capture');
    expect(optionFlags).toContain('--var');
    expect(optionFlags).toContain('--retry-strategy');
    expect(optionFlags).toContain('--max-retries');
    expect(optionFlags).toContain('--retry-delay-seconds');
    expect(optionFlags).toContain('--backoff-multiplier');
    expect(optionFlags).toContain('--timeout-ms');
    expect(optionFlags).toContain('--json');
  });
});
