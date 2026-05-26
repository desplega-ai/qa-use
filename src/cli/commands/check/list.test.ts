import { describe, expect, it } from 'bun:test';
import { buildCheckListQuery, createCheckListColumns, listCommand } from './list.js';

describe('check list command', () => {
  it('has the correct name', () => {
    expect(listCommand.name()).toBe('list');
  });

  it('defines expected options', () => {
    const optionFlags = listCommand.options.map((option) => option.long);
    expect(optionFlags).toContain('--app-config');
    expect(optionFlags).toContain('--q');
    expect(optionFlags).toContain('--limit');
    expect(optionFlags).toContain('--offset');
    expect(optionFlags).toContain('--json');
  });

  it('maps CLI filters to API query params', () => {
    expect(
      buildCheckListQuery({
        appConfig: 'app-1',
        q: 'login',
        limit: '5',
        offset: '10',
      })
    ).toEqual({
      app_config_id: 'app-1',
      q: 'login',
      limit: '5',
      offset: '10',
    });
  });

  it('defines the planned table columns', () => {
    const headers = createCheckListColumns().map((column) => column.header);
    expect(headers).toEqual(['ID', 'NAME', 'TYPE', 'APP_CONFIG', 'STATUS', 'UPDATED']);
  });

  it('falls back to run_status for the status column', () => {
    const statusColumn = createCheckListColumns().find((column) => column.header === 'STATUS');
    expect(statusColumn?.format?.(undefined, { run_status: 'passed' })).toContain('passed');
  });
});
