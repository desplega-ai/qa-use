/**
 * qa-use persona delete - Delete a persona
 */

import { Command } from 'commander';
import { apiCall, confirmAction, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';

export const deleteCommand = new Command('delete')
  .description('Delete a persona')
  .argument('<id>', 'Persona ID (UUID)')
  .option('--force', 'Skip confirmation prompt')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      if (!options.force) {
        const confirmed = await confirmAction(`Delete persona ${id}?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      await apiCall(config, 'DELETE', `/api/v1/personas/${id}`);
      console.log(success(`Persona ${id} deleted`));
    } catch (err) {
      console.log(error(`Failed to delete persona: ${formatError(err)}`));
      process.exit(1);
    }
  });
