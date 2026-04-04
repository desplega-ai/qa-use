/**
 * qa-use test runs cancel - Cancel a running test
 */

import { Command } from 'commander';
import { apiCall, confirmAction, requireApiKey } from '../../../lib/api-helpers.js';
import { loadConfig } from '../../../lib/config.js';
import { error, formatError, success } from '../../../lib/output.js';

export const cancelCommand = new Command('cancel')
  .description('Cancel a running test')
  .argument('<run-id>', 'Test run ID (UUID)')
  .option('--force', 'Skip confirmation prompt')
  .action(async (runId, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      if (!options.force) {
        const confirmed = await confirmAction(`Cancel test run ${runId}?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      await apiCall(config, 'POST', `/api/v1/test-runs/${runId}/cancel`);
      console.log(success(`Test run ${runId} cancelled`));
    } catch (err) {
      console.log(error(`Failed to cancel test run: ${formatError(err)}`));
      process.exit(1);
    }
  });
