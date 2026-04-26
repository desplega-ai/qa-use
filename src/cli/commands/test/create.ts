/**
 * qa-use test create - Push a single test file to the cloud
 *
 * Thin wrapper around the same code path as `qa-use test sync push`, scoped
 * to one file. Useful when you have a YAML in hand and want to send only it
 * (without scanning the configured test directory).
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import { createApiClient, loadConfig } from '../../lib/config.js';
import { loadTestDefinition } from '../../lib/loader.js';
import { error, formatError, info, printValidationErrors } from '../../lib/output.js';
import { planVerb, renderImportResult } from './sync.js';

interface CreateOptions {
  force?: boolean;
  dryRun?: boolean;
}

export const createCommand = new Command('create')
  .description('Push a single test file to the cloud (alias for sync push, scoped to one file)')
  .argument('<file>', 'Path to test definition YAML/JSON')
  .option('--force', 'Overwrite version conflicts')
  .option('--dry-run', 'Validate against the cloud without persisting changes')
  .addHelpText(
    'after',
    `
Examples:
  qa-use test create qa-tests/login.yaml
  qa-use test create /tmp/scratch.yaml --dry-run
  qa-use test create qa-tests/login.yaml --force
`
  )
  .action(async (file: string, options: CreateOptions) => {
    try {
      const config = await loadConfig();

      if (!config.api_key) {
        console.log(error('API key not configured'));
        console.log('  Run `qa-use setup` to configure');
        process.exit(1);
      }

      const filePath = path.resolve(file);
      try {
        await fs.access(filePath);
      } catch {
        console.log(error(`File not found: ${file}`));
        process.exit(1);
      }

      const client = createApiClient(config);

      console.log(`Loading ${filePath}...`);
      const def = await loadTestDefinition(filePath);
      const toImport = [{ file: filePath, def }];
      const testDir = config.test_directory || path.dirname(filePath);

      const force = options.force ?? false;
      const dryRun = options.dryRun ?? false;

      if (dryRun) {
        console.log(info('Dry run - validating with cloud (no changes will be persisted)...\n'));
        const dryResult = await client.importTestDefinition([def], {
          upsert: true,
          force,
          dry_run: true,
        });
        if (dryResult.success) {
          for (const imported of dryResult.imported) {
            console.log(info(`  Would ${planVerb(imported.action)}: ${imported.name}`));
          }
          console.log('');
          console.log(info(`Would import ${dryResult.imported.length} test(s)`));
        } else {
          console.log(error('Dry run failed'));
          printValidationErrors(dryResult.errors);
          process.exit(1);
        }
        return;
      }

      console.log('Importing to cloud...\n');
      const result = await client.importTestDefinition([def], { upsert: true, force });
      await renderImportResult(result, toImport, testDir);

      if (!result.success) {
        process.exit(1);
      }
    } catch (err) {
      console.log(error(`Create failed: ${formatError(err)}`));
      process.exit(1);
    }
  });
