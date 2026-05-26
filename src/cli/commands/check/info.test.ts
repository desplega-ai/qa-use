import { describe, expect, it } from 'bun:test';
import {
  formatCheckValue,
  getCheckStatus,
  infoCommand,
  renderCheckDetails,
  summarizeArray,
  summarizeObject,
} from './info.js';

describe('check info command', () => {
  it('has the correct name', () => {
    expect(infoCommand.name()).toBe('info');
  });

  it('defines check-id as a required argument', () => {
    const args = infoCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('check-id');
    expect(args[0].required).toBe(true);
  });

  it('has --json option', () => {
    const opt = infoCommand.options.find((option) => option.long === '--json');
    expect(opt).toBeDefined();
  });

  it('summarizes config objects without dumping full JSON', () => {
    expect(summarizeObject({ method: 'GET', url: 'https://example.test' })).toBe(
      '2 keys: method, url'
    );
  });

  it('summarizes DES-467 arrays with counts and raw values', () => {
    expect(summarizeArray(['dep-1', 'dep-2'])).toBe('2 items: ["dep-1","dep-2"]');
  });

  it('formats missing values consistently', () => {
    expect(formatCheckValue(undefined)).toBe('-');
    expect(summarizeArray([])).toBe('none');
    expect(summarizeObject({})).toBe('empty object');
  });

  it('prefers explicit status before run_status', () => {
    expect(getCheckStatus({ status: 'active', run_status: 'passed' })).toBe('active');
    expect(getCheckStatus({ run_status: 'failed' })).toBe('failed');
  });

  it('renders dependency, capture, variable, retry, and timeout fields', () => {
    const output = renderCheckDetails({
      id: 'check-1',
      name: 'Login API',
      app_config_id: 'app-1',
      check_type: 'api',
      config: { method: 'POST', url: 'https://example.test/login' },
      validation: { status: 200 },
      variables: [{ name: 'env', value: 'staging' }],
      alias: 'auth',
      check_dependency_ids: ['dep-1'],
      output_captures: [{ name: 'token', json_path: '$.token' }],
      retry_strategy: 'fixed',
      max_retries: 2,
      retry_delay_seconds: 1,
      timeout_ms: 5000,
    });

    expect(output).toContain('Config and Validation');
    expect(output).toContain('Variables');
    expect(output).toContain('Check Dependencies');
    expect(output).toContain('Output Captures');
    expect(output).toContain('Retry Strategy');
    expect(output).toContain('Timeout MS');
    expect(output).toContain('auth');
  });
});
