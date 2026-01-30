/**
 * qa-use test schema - View test definition schema
 */

import { Command } from 'commander';
import { ApiClient } from '../../../../lib/api/index.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, info } from '../../lib/output.js';

export const schemaCommand = new Command('schema')
  .description('View test definition schema')
  .argument(
    '[path]',
    'JSON path to specific schema part (e.g., "SimpleStep.action", "$defs.ActionInstruction")'
  )
  .addHelpText(
    'after',
    `
Examples:
  qa-use test schema                     # Full schema
  qa-use test schema SimpleStep          # SimpleStep definition
  qa-use test schema SimpleStep.action   # Valid simple actions
  qa-use test schema --raw | jq '.properties.steps'  # Use jq for advanced queries
`
  )
  .option('--raw', 'Output raw JSON without formatting')
  .action(async (schemaPath, options) => {
    try {
      const config = await loadConfig();

      // Initialize API client
      const client = new ApiClient(config.api_url);
      if (config.api_key) {
        client.setApiKey(config.api_key);
      }

      // Fetch schema
      const schema = await client.getTestDefinitionSchema();

      let output: unknown = schema;

      // Navigate to specific path if provided
      if (schemaPath) {
        const parts = schemaPath.split('.');
        for (const part of parts) {
          if (output && typeof output === 'object') {
            const obj = output as Record<string, unknown>;
            // Handle $defs references
            if (part === '$defs' || part in obj) {
              output = obj[part];
            } else if (
              obj.$defs &&
              typeof obj.$defs === 'object' &&
              part in (obj.$defs as object)
            ) {
              output = (obj.$defs as Record<string, unknown>)[part];
            } else if (
              obj.properties &&
              typeof obj.properties === 'object' &&
              part in (obj.properties as object)
            ) {
              output = (obj.properties as Record<string, unknown>)[part];
            } else {
              console.log(error(`Path "${schemaPath}" not found in schema`));
              console.log(info(`Available keys: ${Object.keys(obj).join(', ')}`));
              process.exit(1);
            }
          }
        }
      }

      // Output
      if (options.raw) {
        console.log(JSON.stringify(output));
      } else {
        console.log(JSON.stringify(output, null, 2));

        // If output contains a $ref, suggest follow-up command
        if (
          output &&
          typeof output === 'object' &&
          '$ref' in output &&
          typeof (output as Record<string, unknown>).$ref === 'string'
        ) {
          const ref = (output as Record<string, unknown>).$ref as string;
          // Parse "#/$defs/ActionInstruction" -> "$defs.ActionInstruction"
          const refPath = ref.replace(/^#\//, '').replace(/\//g, '.');
          console.log(info(`\nThis is a reference. To resolve it, run:`));
          console.log(`  qa-use test schema ${refPath}`);
        }
      }
    } catch (err) {
      console.log(error(`Failed to fetch schema: ${formatError(err)}`));
      process.exit(1);
    }
  });
