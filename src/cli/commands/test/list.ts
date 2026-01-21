/**
 * qa-use test list - List test definitions
 */

import { Command } from 'commander';
import * as path from 'path';
import { loadConfig } from '../../lib/config.js';
import { discoverTests, loadTestDefinition } from '../../lib/loader.js';
import { printTestList, error } from '../../lib/output.js';
import { ApiClient } from '../../../../lib/api/index.js';

export const listCommand = new Command('list')
  .description('List test definitions')
  .option('--cloud', 'List tests from cloud instead of local files')
  .option('--limit <number>', 'Maximum number of tests to list', '20')
  .action(async (options) => {
    try {
      const config = await loadConfig();

      if (options.cloud) {
        // List cloud tests
        if (!config.api_key) {
          console.log(error('API key not configured'));
          console.log('  Run `qa-use setup` to configure');
          process.exit(1);
        }

        const client = new ApiClient(config.api_url);
        client.setApiKey(config.api_key);

        console.log('Fetching tests from cloud...\n');
        const tests = await client.listTests({ limit: parseInt(options.limit) });

        const formatted = tests.map((t) => ({
          name: `${t.name} (${t.id})`,
          steps: undefined,
          deps: t.dependency_test_ids?.join(', '),
        }));

        printTestList(formatted);
      } else {
        // List local tests
        const testDir = config.test_directory || './qa-tests';
        const files = await discoverTests(testDir);

        if (files.length === 0) {
          console.log(error(`No tests found in ${testDir}`));
          console.log('  Run `qa-use test init` to create example tests');
          return;
        }

        const tests = [];
        const resolvedTestDir = path.resolve(testDir);
        for (const file of files) {
          try {
            const def = await loadTestDefinition(file);
            const relativePath = path
              .relative(resolvedTestDir, file)
              .replace(/\.(yaml|yml|json)$/, '');
            tests.push({
              name: relativePath,
              steps: def.steps?.length,
              deps: def.depends_on || undefined,
            });
          } catch (err) {
            console.log(error(`Failed to load ${file}: ${err}`));
          }
        }

        printTestList(tests);
      }
    } catch (err) {
      console.log(error(`Failed to list tests: ${err}`));
      process.exit(1);
    }
  });
