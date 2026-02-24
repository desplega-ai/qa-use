import { describe, expect, it } from 'bun:test';
import type { TestDefinition } from '../../../src/types/test-definition.js';
import { applyVariableOverrides } from './loader.js';

describe('applyVariableOverrides', () => {
  it('should apply overrides to a single test definition', () => {
    const definitions: TestDefinition[] = [
      {
        name: 'Test A',
        variables: { email: 'default@test.com' },
        steps: [{ action: 'goto', url: '/a' }],
      },
    ];

    applyVariableOverrides(definitions, { email: 'override@test.com' });

    expect(definitions[0].variables).toEqual({ email: 'override@test.com' });
  });

  it('should apply overrides to all definitions including dependencies', () => {
    const definitions: TestDefinition[] = [
      {
        name: 'Login (dependency)',
        id: 'login',
        variables: { email: 'default@test.com', password: 'secret' },
        steps: [{ action: 'goto', url: '/login' }],
      },
      {
        name: 'Dashboard (main)',
        depends_on: 'login',
        variables: { email: 'default@test.com' },
        steps: [{ action: 'goto', url: '/dashboard' }],
      },
    ];

    applyVariableOverrides(definitions, { email: 'new@test.com' });

    // Both definitions should have the override
    expect(definitions[0].variables!.email).toBe('new@test.com');
    expect(definitions[1].variables!.email).toBe('new@test.com');
    // Non-overridden vars should remain
    expect(definitions[0].variables!.password).toBe('secret');
  });

  it('should create variables object if not present', () => {
    const definitions: TestDefinition[] = [
      {
        name: 'Test without vars',
        steps: [{ action: 'goto', url: '/a' }],
      },
    ];

    applyVariableOverrides(definitions, { key: 'value' });

    expect(definitions[0].variables).toEqual({ key: 'value' });
  });

  it('should add new variables alongside existing ones', () => {
    const definitions: TestDefinition[] = [
      {
        name: 'Test A',
        variables: { existing: 'value' },
        steps: [{ action: 'goto', url: '/a' }],
      },
    ];

    applyVariableOverrides(definitions, { new_var: 'new_value' });

    expect(definitions[0].variables).toEqual({
      existing: 'value',
      new_var: 'new_value',
    });
  });

  it('should handle multiple overrides at once', () => {
    const definitions: TestDefinition[] = [
      {
        name: 'Test A',
        variables: { a: '1', b: '2', c: '3' },
        steps: [{ action: 'goto', url: '/a' }],
      },
    ];

    applyVariableOverrides(definitions, { a: 'x', c: 'z' });

    expect(definitions[0].variables).toEqual({ a: 'x', b: '2', c: 'z' });
  });

  it('should handle empty overrides (no-op)', () => {
    const definitions: TestDefinition[] = [
      {
        name: 'Test A',
        variables: { email: 'original@test.com' },
        steps: [{ action: 'goto', url: '/a' }],
      },
    ];

    applyVariableOverrides(definitions, {});

    expect(definitions[0].variables).toEqual({ email: 'original@test.com' });
  });

  it('should handle empty definitions array', () => {
    const definitions: TestDefinition[] = [];

    // Should not throw
    applyVariableOverrides(definitions, { key: 'value' });

    expect(definitions).toHaveLength(0);
  });

  it('should apply same overrides to chain of three dependencies', () => {
    const definitions: TestDefinition[] = [
      {
        name: 'Setup',
        id: 'setup',
        variables: { base_url: 'https://prod.example.com' },
        steps: [{ action: 'goto', url: '/setup' }],
      },
      {
        name: 'Login',
        id: 'login',
        depends_on: 'setup',
        variables: { base_url: 'https://prod.example.com', user: 'admin' },
        steps: [{ action: 'goto', url: '/login' }],
      },
      {
        name: 'Dashboard',
        depends_on: 'login',
        variables: { base_url: 'https://prod.example.com' },
        steps: [{ action: 'goto', url: '/dashboard' }],
      },
    ];

    applyVariableOverrides(definitions, { base_url: 'https://staging.example.com' });

    // All three should have the override
    for (const def of definitions) {
      expect(def.variables!.base_url).toBe('https://staging.example.com');
    }
    // Other vars should be preserved
    expect(definitions[1].variables!.user).toBe('admin');
  });
});
