/**
 * qa-use check-schedule delete - Delete a remote check schedule
 */

import { Command } from 'commander';
import { apiCall, confirmAction, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';

export const deleteCommand = new Command('delete')
  .description('Delete a remote check schedule')
  .argument('<schedule-id>', 'Check schedule ID (UUID)')
  .option('--force', 'Skip confirmation prompt')
  .action(async (scheduleId: string, options: { force?: boolean }) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      if (!options.force) {
        const confirmed = await confirmAction(`Delete check schedule ${scheduleId}?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      await apiCall(config, 'DELETE', `/api/v1/check-schedules/${scheduleId}`);
      console.log(success(`Check schedule ${scheduleId} deleted`));
    } catch (err) {
      console.log(error(`Failed to delete check schedule: ${formatError(err)}`));
      process.exit(1);
    }
  });
