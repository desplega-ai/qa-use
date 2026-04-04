import { describe, expect, it } from 'bun:test';
import { examplesCommand } from './examples.js';

describe('api examples command', () => {
  it('has correct name and description', () => {
    expect(examplesCommand.name()).toBe('examples');
    expect(examplesCommand.description()).toBe('Show API command usage examples');
  });

  it('has no required arguments', () => {
    expect(examplesCommand.registeredArguments.length).toBe(0);
  });
});
