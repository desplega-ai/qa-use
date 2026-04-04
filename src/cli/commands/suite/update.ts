/**
 * qa-use suite update - Update an existing test suite
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

export const updateCommand = new Command('update')
  .description('Update an existing test suite')
  .argument('<id>', 'Test suite ID (UUID)')
  .option('--input <file>', 'JSON file with suite definition')
  .option('-F, --field <key=value>', 'Set field (repeatable)', collectFields, [])
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const body = await parseResourceInput(options);

      if (Object.keys(body).length === 0) {
        console.log(error('No fields provided'));
        console.log('  Use -F key=value or --input <file>');
        process.exit(1);
      }

      await apiCall(config, 'PUT', `/api/v1/test-suites/${id}`, { body });

      console.log(success(`Test suite ${id} updated`));
    } catch (err) {
      console.log(error(`Failed to update test suite: ${formatError(err)}`));
      process.exit(1);
    }
  });
