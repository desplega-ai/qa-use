/**
 * qa-use app-context delete - Delete an app context
 */

import { Command } from 'commander';
import { apiCall, confirmAction, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';

export const deleteCommand = new Command('delete')
  .description('Delete an app context')
  .argument('<id>', 'App context ID (UUID)')
  .option('--force', 'Skip confirmation prompt')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      if (!options.force) {
        const confirmed = await confirmAction(`Delete app context ${id}?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      await apiCall(config, 'DELETE', `/api/v1/app-contexts/${id}`);
      console.log(success(`App context ${id} deleted`));
    } catch (err) {
      console.log(error(`Failed to delete app context: ${formatError(err)}`));
      process.exit(1);
    }
  });
