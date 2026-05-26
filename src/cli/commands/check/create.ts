/**
 * qa-use check create - Create a remote API check
 */

import { Command } from 'commander';
import { apiCall, collectFields, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';
import {
  buildCheckInputBody,
  type CheckInputOptions,
  collectValues,
  validateCheckCreateBody,
} from './lib.js';

interface CheckCreateOptions extends CheckInputOptions {
  json?: boolean;
}

export const createCommand = new Command('create')
  .description('Create a remote API check')
  .option('--name <name>', 'Check name (required unless supplied by --input or -F)')
  .option('--description <text>', 'Check description')
  .option('--app-config <id>', 'App config ID (required unless supplied by --input or -F)')
  .option('--type <api|script>', 'Check type (default: api)', 'api')
  .option('--config <file>', 'JSON object file for check config')
  .option('--validation <file>', 'JSON object file for validation rules')
  .option('--input <file|->', 'JSON object with check fields, or - to read from stdin')
  .option('-F, --field <key=value>', 'Set raw API field (repeatable)', collectFields, [])
  .option('--depends-on <id>', 'Check dependency ID (repeatable)', collectValues, [])
  .option('--alias <name>', 'Alias exposed to downstream checks')
  .option(
    '--capture <name=json_path>',
    'Output capture to expose downstream (repeatable)',
    collectValues,
    []
  )
  .option('--var <key=value>', 'Check variable (repeatable)', collectValues, [])
  .option('--retry-strategy <none|simple|exponential>', 'Retry strategy')
  .option('--max-retries <n>', 'Maximum retry attempts')
  .option('--retry-delay-seconds <seconds>', 'Delay between retries')
  .option('--backoff-multiplier <n>', 'Exponential retry backoff multiplier')
  .option('--timeout-ms <ms>', 'Check timeout in milliseconds')
  .option('--json', 'Output created check as JSON')
  .action(async (options: CheckCreateOptions) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const body = await buildCheckInputBody(options);
      validateCheckCreateBody(body);

      const result = (await apiCall(config, 'POST', '/api/v1/checks', { body })) as Record<
        string,
        unknown
      >;

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(success(`Check created (ID: ${String(result.id ?? '-')})`));
    } catch (err) {
      console.log(error(`Failed to create check: ${formatError(err)}`));
      process.exit(1);
    }
  });
