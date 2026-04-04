import { describe, expect, it } from 'bun:test';
import { uploadCommand } from './upload.js';

describe('data-asset upload command', () => {
  it('requires file argument', () => {
    expect(uploadCommand.registeredArguments.length).toBe(1);
    expect(uploadCommand.registeredArguments[0].name()).toBe('file');
    expect(uploadCommand.registeredArguments[0].required).toBe(true);
  });

  it('has -F/--field option', () => {
    const opt = uploadCommand.options.find((o) => o.long === '--field');
    expect(opt).toBeDefined();
    expect(opt?.short).toBe('-F');
  });

  it('has --json option', () => {
    const opt = uploadCommand.options.find((o) => o.long === '--json');
    expect(opt).toBeDefined();
  });
});
