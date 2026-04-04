import { describe, expect, it } from 'bun:test';
import { openapiCommand } from './openapi.js';

describe('api openapi command', () => {
  it('has correct name and description', () => {
    expect(openapiCommand.name()).toBe('openapi');
    expect(openapiCommand.description()).toBe('Show OpenAPI spec URL or dump full spec');
  });

  it('defines expected options', () => {
    const optionFlags = openapiCommand.options.map((option) => option.long);
    expect(optionFlags).toContain('--raw');
    expect(optionFlags).toContain('--refresh');
    expect(optionFlags).toContain('--offline');
  });
});
