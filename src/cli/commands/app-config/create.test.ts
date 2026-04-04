import { describe, expect, it } from 'bun:test';
import { createCommand } from './create.js';

describe('app-config create command', () => {
  it('has --input option', () => {
    const opt = createCommand.options.find((o) => o.long === '--input');
    expect(opt).toBeDefined();
  });

  it('has -F/--field option', () => {
    const opt = createCommand.options.find((o) => o.long === '--field');
    expect(opt).toBeDefined();
    expect(opt?.short).toBe('-F');
  });
});
