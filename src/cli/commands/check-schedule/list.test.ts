import { describe, expect, it } from 'bun:test';
import {
  buildCheckScheduleListQuery,
  createCheckScheduleListColumns,
  listCommand,
} from './list.js';

describe('check-schedule list command', () => {
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
      buildCheckScheduleListQuery({
        appConfig: 'app-1',
        q: 'claims',
        limit: '5',
        offset: '10',
      })
    ).toEqual({
      app_config_id: 'app-1',
      q: 'claims',
      limit: '5',
      offset: '10',
    });
  });

  it('defines readable schedule table columns', () => {
    const headers = createCheckScheduleListColumns().map((column) => column.header);
    expect(headers).toEqual([
      'ID',
      'NAME',
      'APP_CONFIG',
      'CRON',
      'TZ',
      'ENABLED',
      'CHECKS',
      'UPDATED',
    ]);
  });

  it('defaults missing timezone display to UTC', () => {
    const tzColumn = createCheckScheduleListColumns().find((column) => column.header === 'TZ');
    expect(tzColumn?.format?.(undefined, {})).toBe('UTC');
  });
});
