/**
 * qa-use app-context update - Update an existing app context
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
  .description('Update an existing app context')
  .argument('<id>', 'App context ID (UUID)')
  .option('--input <file>', 'JSON file with app context definition')
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

      await apiCall(config, 'PATCH', `/api/v1/app-contexts/${id}`, { body });

      console.log(success(`App context ${id} updated`));
    } catch (err) {
      console.log(error(`Failed to update app context: ${formatError(err)}`));
      process.exit(1);
    }
  });
