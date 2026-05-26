/**
 * qa-use check update - Update a remote API check
 */

import { Command } from 'commander';
import { apiCall, collectFields, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, success } from '../../lib/output.js';
import {
  buildCheckInputBody,
  type CheckInputOptions,
  collectValues,
  validateCheckUpdateBody,
} from './lib.js';

interface CheckUpdateOptions extends CheckInputOptions {
  json?: boolean;
}

export const updateCommand = new Command('update')
  .description('Update a remote API check')
  .argument('<check-id>', 'Check ID (UUID)')
  .option('--name <name>', 'Check name')
  .option('--description <text>', 'Check description')
  .option('--app-config <id>', 'App config ID')
  .option('--type <api|script>', 'Check type')
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
  .option('--json', 'Output updated check as JSON')
  .action(async (checkId: string, options: CheckUpdateOptions) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const body = await buildCheckInputBody(options);
      validateCheckUpdateBody(body);

      const result = (await apiCall(config, 'PATCH', `/api/v1/checks/${checkId}`, {
        body,
      })) as Record<string, unknown>;

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(success(`Check ${checkId} updated`));
    } catch (err) {
      console.log(error(`Failed to update check: ${formatError(err)}`));
      process.exit(1);
    }
  });
