/**
 * qa-use suite delete - Delete a test suite
 */

import { Command } from 'commander';
import { apiCall, confirmAction, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';

export const deleteCommand = new Command('delete')
  .description('Delete a test suite')
  .argument('<id>', 'Test suite ID (UUID)')
  .option('--force', 'Skip confirmation prompt')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      if (!options.force) {
        const confirmed = await confirmAction(`Delete test suite ${id}?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      await apiCall(config, 'DELETE', `/api/v1/test-suites/${id}`);
      console.log(success(`Test suite ${id} deleted`));
    } catch (err) {
      console.log(error(`Failed to delete test suite: ${formatError(err)}`));
      process.exit(1);
    }
  });
