/**
 * qa-use data-asset delete - Delete a data asset
 */

import { Command } from 'commander';
import { apiCall, confirmAction, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';

export const deleteCommand = new Command('delete')
  .description('Delete a data asset')
  .argument('<id>', 'Data asset ID (UUID)')
  .option('--force', 'Skip confirmation prompt')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      if (!options.force) {
        const confirmed = await confirmAction(`Delete data asset ${id}?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      await apiCall(config, 'DELETE', `/api/v1/data-assets/${id}`);
      console.log(success(`Data asset ${id} deleted`));
    } catch (err) {
      console.log(error(`Failed to delete data asset: ${formatError(err)}`));
      process.exit(1);
    }
  });
