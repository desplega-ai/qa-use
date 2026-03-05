import { describe, expect, it } from 'bun:test';
import { lsCommand } from './ls.js';

describe('api ls command', () => {
  it('defines expected list options', () => {
    const optionFlags = lsCommand.options.map((option) => option.long);
    expect(optionFlags).toContain('--method');
    expect(optionFlags).toContain('--query');
    expect(optionFlags).toContain('--tag');
    expect(optionFlags).toContain('--json');
    expect(optionFlags).toContain('--refresh');
    expect(optionFlags).toContain('--offline');
  });
});
