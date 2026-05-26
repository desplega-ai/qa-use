/**
 * qa-use check-schedule create - Create a remote check schedule
 */

import { Command } from 'commander';
import { apiCall, collectFields, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';
import {
  buildCheckScheduleInputBody,
  type CheckScheduleInputOptions,
  collectValues,
  validateCheckScheduleCreateBody,
} from '../check/lib.js';

interface CheckScheduleCreateOptions extends CheckScheduleInputOptions {
  json?: boolean;
}

export const createCommand = new Command('create')
  .description('Create a remote check schedule')
  .option('--name <name>', 'Schedule name (required unless supplied by --input or -F)')
  .option('--description <text>', 'Schedule description')
  .option('--app-config <id>', 'App config ID (required unless supplied by --input or -F)')
  .option('--check <id>', 'Check ID included in the schedule (repeatable)', collectValues, [])
  .option('--cron <expr>', 'Cron expression (required unless supplied by --input or -F)')
  .option('--timezone <tz>', 'Schedule timezone (display defaults to UTC when omitted)')
  .option('--enabled', 'Create the schedule enabled')
  .option('--disabled', 'Create the schedule disabled')
  .option(
    '--failure-strategy <stop_on_failure|continue_on_failure>',
    'Failure strategy for the ordered check chain'
  )
  .option('--dependency-condition <json>', 'JSON object for check_dependency_graph_conditions')
  .option('--input <file|->', 'JSON object with schedule fields, or - to read from stdin')
  .option('-F, --field <key=value>', 'Set raw API field (repeatable)', collectFields, [])
  .option('--json', 'Output created check schedule as JSON')
  .action(async (options: CheckScheduleCreateOptions) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const body = await buildCheckScheduleInputBody(options);
      validateCheckScheduleCreateBody(body);

      const result = (await apiCall(config, 'POST', '/api/v1/check-schedules', {
        body,
      })) as Record<string, unknown>;

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(success(`Check schedule created (ID: ${String(result.id ?? '-')})`));
    } catch (err) {
      console.log(error(`Failed to create check schedule: ${formatError(err)}`));
      process.exit(1);
    }
  });
