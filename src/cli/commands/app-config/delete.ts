/**
 * qa-use app-config delete - Delete an app configuration
 */

import { Command } from 'commander';
import { apiCall, confirmAction, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';

export const deleteCommand = new Command('delete')
  .description('Delete an app configuration')
  .argument('<id>', 'App configuration ID (UUID)')
  .option('--force', 'Skip confirmation prompt')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      if (!options.force) {
        const confirmed = await confirmAction(`Delete app configuration ${id}?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      await apiCall(config, 'DELETE', `/api/v1/app-configs/${id}`);
      console.log(success(`App configuration ${id} deleted`));
    } catch (err) {
      console.log(error(`Failed to delete app configuration: ${formatError(err)}`));
      process.exit(1);
    }
  });
