import { describe, expect, it } from 'bun:test';
import { infoCommand, renderCheckScheduleDetails } from './info.js';

describe('check-schedule info command', () => {
  it('has the correct name', () => {
    expect(infoCommand.name()).toBe('info');
  });

  it('defines schedule-id as a required argument', () => {
    const args = infoCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('schedule-id');
    expect(args[0].required).toBe(true);
  });

  it('has --json option', () => {
    const opt = infoCommand.options.find((option) => option.long === '--json');
    expect(opt).toBeDefined();
  });

  it('renders schedule details with UTC fallback and dependency fields', () => {
    const output = renderCheckScheduleDetails({
      id: 'schedule-1',
      name: 'Claims chain',
      app_config_id: 'app-1',
      cron_expression: '*/15 * * * *',
      enabled: true,
      failure_strategy: 'stop_on_failure',
      check_ids: ['check-1', 'check-2'],
      check_dependency_graph_conditions: { 'check-2': { depends_on: ['check-1'] } },
    });

    expect(output).toContain('Check Schedule Details');
    expect(output).toContain('UTC');
    expect(output).toContain('Failure Strategy');
    expect(output).toContain('Check IDs');
    expect(output).toContain('Dependency Conditions');
    expect(output).toContain('2 items');
  });
});
