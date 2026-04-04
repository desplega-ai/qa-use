/**
 * qa-use app-config update - Update an existing app configuration
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
  .description('Update an existing app configuration')
  .argument('<id>', 'App configuration ID (UUID)')
  .option('--input <file>', 'JSON file with app configuration definition')
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

      await apiCall(config, 'PATCH', `/api/v1/app-configs/${id}`, { body });

      console.log(success(`App configuration ${id} updated`));
    } catch (err) {
      console.log(error(`Failed to update app configuration: ${formatError(err)}`));
      process.exit(1);
    }
  });
