import { describe, expect, it } from 'bun:test';
import { Readable } from 'node:stream';
import {
  buildCheckScheduleInputBody,
  buildCheckScheduleRunBody,
  formatCheckScheduleRunResponse,
  getCheckScheduleRunId,
  getCheckScheduleRunStatus,
  validateCheckScheduleCreateBody,
  validateCheckScheduleFailureStrategy,
  validateCheckScheduleUpdateBody,
} from '../check/lib.js';

describe('check-schedule helpers', () => {
  it('maps friendly schedule flags to exact API body keys', async () => {
    const body = await buildCheckScheduleInputBody({
      input: '-',
      stdin: Readable.from([
        '{"name":"From input","app_config_id":"input-app","cron_expression":"0 0 * * *"}',
      ]),
      field: ['name=From field', 'enabled=false'],
      name: 'Claims chain',
      appConfig: 'app-1',
      check: ['check-1', 'check-2'],
      cron: '*/15 * * * *',
      timezone: 'America/New_York',
      enabled: true,
      failureStrategy: 'stop_on_failure',
      dependencyCondition: '{"check-2":{"depends_on":["check-1"]}}',
    });

    expect(body).toMatchObject({
      name: 'Claims chain',
      app_config_id: 'app-1',
      check_ids: ['check-1', 'check-2'],
      cron_expression: '*/15 * * * *',
      timezone: 'America/New_York',
      enabled: true,
      failure_strategy: 'stop_on_failure',
      check_dependency_graph_conditions: {
        'check-2': { depends_on: ['check-1'] },
      },
    });
  });

  it('rejects conflicting enabled flags and invalid dependency conditions', async () => {
    await expect(buildCheckScheduleInputBody({ enabled: true, disabled: true })).rejects.toThrow(
      '--enabled and --disabled cannot be used together'
    );

    await expect(
      buildCheckScheduleInputBody({ dependencyCondition: '["not","object"]' })
    ).rejects.toThrow('--dependency-condition must be a JSON object');
  });

  it('validates schedule create and update bodies', () => {
    expect(() => validateCheckScheduleCreateBody({ name: 'Claims chain' })).toThrow(
      'app_config_id, cron_expression'
    );
    expect(() =>
      validateCheckScheduleCreateBody({
        name: 'Claims chain',
        app_config_id: 'app-1',
        cron_expression: '*/15 * * * *',
      })
    ).not.toThrow();
    expect(() => validateCheckScheduleUpdateBody({})).toThrow('No fields provided');
  });

  it('validates enum-like failure strategy input', () => {
    expect(validateCheckScheduleFailureStrategy('continue_on_failure')).toBe('continue_on_failure');
    expect(() => validateCheckScheduleFailureStrategy('retry')).toThrow('Invalid failure strategy');
  });

  it('builds the run action body with DES-467 variables', () => {
    expect(
      buildCheckScheduleRunBody('schedule-1', { var: ['env=staging', 'claim_id=123'] })
    ).toEqual({
      schedule_id: 'schedule-1',
      variables: [
        { key: 'env', value: 'staging' },
        { key: 'claim_id', value: 123 },
      ],
    });
  });

  it('best-effort formats untyped run responses', () => {
    const response = {
      check_schedule_run_id: 'run-1',
      run_status: 'queued',
    };

    expect(getCheckScheduleRunId(response)).toBe('run-1');
    expect(getCheckScheduleRunStatus(response)).toBe('queued');

    const output = formatCheckScheduleRunResponse(response);
    expect(output).toContain('run-1');
    expect(output).toContain('queued');
    expect(output).toContain('--json');
    expect(output).toContain('raw untyped run response');
  });
});
