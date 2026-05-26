/**
 * qa-use check-schedule update - Update a remote check schedule
 */

import { Command } from 'commander';
import { apiCall, collectFields, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';
import {
  buildCheckScheduleInputBody,
  type CheckScheduleInputOptions,
  collectValues,
  validateCheckScheduleUpdateBody,
} from '../check/lib.js';

interface CheckScheduleUpdateOptions extends CheckScheduleInputOptions {
  json?: boolean;
}

export const updateCommand = new Command('update')
  .description('Update a remote check schedule')
  .argument('<schedule-id>', 'Check schedule ID (UUID)')
  .option('--name <name>', 'Schedule name')
  .option('--description <text>', 'Schedule description')
  .option('--app-config <id>', 'App config ID')
  .option('--check <id>', 'Check ID included in the schedule (repeatable)', collectValues, [])
  .option('--cron <expr>', 'Cron expression')
  .option('--timezone <tz>', 'Schedule timezone')
  .option('--enabled', 'Enable the schedule')
  .option('--disabled', 'Disable the schedule')
  .option(
    '--failure-strategy <stop_on_failure|continue_on_failure>',
    'Failure strategy for the ordered check chain'
  )
  .option('--dependency-condition <json>', 'JSON object for check_dependency_graph_conditions')
  .option('--input <file|->', 'JSON object with schedule fields, or - to read from stdin')
  .option('-F, --field <key=value>', 'Set raw API field (repeatable)', collectFields, [])
  .option('--json', 'Output updated check schedule as JSON')
  .action(async (scheduleId: string, options: CheckScheduleUpdateOptions) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const body = await buildCheckScheduleInputBody(options);
      validateCheckScheduleUpdateBody(body);

      const result = (await apiCall(config, 'PATCH', `/api/v1/check-schedules/${scheduleId}`, {
        body,
      })) as Record<string, unknown>;

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(success(`Check schedule ${scheduleId} updated`));
    } catch (err) {
      console.log(error(`Failed to update check schedule: ${formatError(err)}`));
      process.exit(1);
    }
  });
