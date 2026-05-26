/**
 * qa-use check delete - Delete a remote API check
 */

import { Command } from 'commander';
import { apiCall, confirmAction, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';

export const deleteCommand = new Command('delete')
  .description('Delete a remote API check')
  .argument('<check-id>', 'Check ID (UUID)')
  .option('--force', 'Skip confirmation prompt')
  .action(async (checkId: string, options: { force?: boolean }) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      if (!options.force) {
        const confirmed = await confirmAction(`Delete check ${checkId}?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      await apiCall(config, 'DELETE', `/api/v1/checks/${checkId}`);
      console.log(success(`Check ${checkId} deleted`));
    } catch (err) {
      console.log(error(`Failed to delete check: ${formatError(err)}`));
      process.exit(1);
    }
  });
