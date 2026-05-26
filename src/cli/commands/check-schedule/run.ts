/**
 * qa-use check-schedule run - Run a remote check schedule chain
 */

import { Command } from 'commander';
import { apiCall, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError } from '../../lib/output.js';
import {
  buildCheckScheduleRunBody,
  collectValues,
  formatCheckScheduleRunResponse,
} from '../check/lib.js';

export const runCommand = new Command('run')
  .description('Run the remote schedule chain in dependency order')
  .argument('<schedule-id>', 'Check schedule ID (UUID)')
  .option(
    '--var <key=value>',
    'Seed variable for the remote schedule chain (repeatable)',
    collectValues,
    []
  )
  .option('--json', 'Output raw untyped run response as JSON')
  .action(async (scheduleId: string, options: { var?: string[]; json?: boolean }) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const result = (await apiCall(config, 'POST', '/api/v1/check-schedules-actions/run', {
        body: buildCheckScheduleRunBody(scheduleId, options),
      })) as Record<string, unknown>;

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(formatCheckScheduleRunResponse(result));
    } catch (err) {
      console.log(error(`Failed to run check schedule: ${formatError(err)}`));
      process.exit(1);
    }
  });
