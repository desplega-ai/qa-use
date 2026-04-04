/**
 * qa-use suite create - Create a new test suite
 */

import { Command } from 'commander';
import {
  apiCall,
  collectFields,
  parseResourceInput,
  requireApiKey,
} from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';

export const createCommand = new Command('create')
  .description('Create a new test suite')
  .option('--input <file>', 'JSON file with suite definition')
  .option('-F, --field <key=value>', 'Set field (repeatable)', collectFields, [])
  .action(async (options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const body = await parseResourceInput(options);

      if (!body.name) {
        console.log(error('Missing required field: name'));
        console.log('  Use -F name="My Suite" or --input <file>');
        process.exit(1);
      }

      const result = (await apiCall(config, 'POST', '/api/v1/test-suites', { body })) as Record<
        string,
        unknown
      >;

      console.log(success(`Test suite created (ID: ${result.id})`));
    } catch (err) {
      console.log(error(`Failed to create test suite: ${formatError(err)}`));
      process.exit(1);
    }
  });
