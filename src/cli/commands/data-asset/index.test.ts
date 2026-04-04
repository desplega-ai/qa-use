import { describe, expect, it } from 'bun:test';
import { dataAssetCommand } from './index.js';

describe('data-asset command', () => {
  it('has the correct name', () => {
    expect(dataAssetCommand.name()).toBe('data-asset');
  });

  it('registers all expected subcommands', () => {
    const names = dataAssetCommand.commands.map((c) => c.name());
    expect(names).toContain('list');
    expect(names).toContain('info');
    expect(names).toContain('upload');
    expect(names).toContain('delete');
  });
});
