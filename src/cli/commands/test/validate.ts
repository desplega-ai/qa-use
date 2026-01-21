/**
 * qa-use test validate - Validate test definitions
 */

import { Command } from 'commander';
import { loadConfig } from '../../lib/config.js';
import { loadTestWithDeps } from '../../lib/loader.js';
import { error, success, printValidationErrors } from '../../lib/output.js';
import { ApiClient } from '../../../../lib/api/index.js';

export const validateCommand = new Command('validate')
  .description('Validate test definition without running')
  .argument('<test>', 'Test name or path')
  .option('--strict', 'Treat warnings as errors')
  .action(async (test, options) => {
    try {
      const config = await loadConfig();

      // Check API key
      if (!config.api_key) {
        console.log(error('API key not configured'));
        console.log('  Run `qa-use setup` to configure');
        process.exit(1);
      }

      // Initialize API client
      const client = new ApiClient(config.api_url);
      client.setApiKey(config.api_key);

      // Load test definitions
      console.log(`Loading test: ${test}...`);
      const definitions = await loadTestWithDeps(test, config.test_directory || './qa-tests');
      console.log(success(`Loaded ${definitions.length} test(s)\n`));

      // Validate
      console.log('Validating...');
      const validation = await client.validateTestDefinition(definitions);

      if (validation.valid) {
        console.log(success('Validation passed\n'));

        if (validation.resolved) {
          console.log('Resolved:');
          if (validation.resolved.app_config_id) {
            console.log(`  App Config: ${validation.resolved.app_config_id}`);
          }
          if (validation.resolved.total_steps !== undefined) {
            console.log(`  Total Steps: ${validation.resolved.total_steps}`);
          }
          if (validation.resolved.dependencies && validation.resolved.dependencies.length > 0) {
            console.log(`  Dependencies: ${validation.resolved.dependencies.join(', ')}`);
          }
        }

        if (validation.warnings.length > 0) {
          console.log(`\n⚠️  ${validation.warnings.length} warnings:`);
          printValidationErrors(validation.warnings);

          if (options.strict) {
            process.exit(1);
          }
        }
      } else {
        console.log(error('Validation failed\n'));
        console.log(`Errors (${validation.errors.length}):`);
        printValidationErrors(validation.errors);

        if (validation.warnings.length > 0) {
          console.log(`\nWarnings (${validation.warnings.length}):`);
          printValidationErrors(validation.warnings);
        }

        process.exit(1);
      }
    } catch (err) {
      console.log(error(`Validation failed: ${err}`));
      process.exit(1);
    }
  });
