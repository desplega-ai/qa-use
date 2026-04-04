/**
 * qa-use suite run - Run all tests in a suite
 */

import { Command } from 'commander';
import { apiCall, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, info, success } from '../../lib/output.js';

export const runCommand = new Command('run')
  .description('Run all tests in a suite')
  .argument('<id>', 'Test suite ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const result = (await apiCall(config, 'POST', '/api/v1/test-suites-actions/run', {
        body: { suite_id: id },
      })) as Record<string, unknown>;

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      const suiteRunId = result.suite_run_id ?? result.id;
      const status = result.status ?? 'submitted';

      console.log(success(`Suite run started (ID: ${suiteRunId})`));
      console.log(`  Status: ${status}`);
      console.log(info(`Check progress: qa-use api -X GET /api/v1/test-suite-runs/${suiteRunId}`));
    } catch (err) {
      console.log(error(`Failed to run test suite: ${formatError(err)}`));
      process.exit(1);
    }
  });
