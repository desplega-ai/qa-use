/**
 * qa-use test sync - Sync local and cloud tests
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadConfig } from '../../lib/config.js';
import { discoverTests, loadTestDefinition } from '../../lib/loader.js';
import { error, success, info, warning } from '../../lib/output.js';
import { ApiClient } from '../../../../lib/api/index.js';

export const syncCommand = new Command('sync')
  .description('Sync local tests with cloud')
  .option('--pull', 'Pull tests from cloud to local (default)')
  .option('--push', 'Push local tests to cloud')
  .option('--dry-run', 'Show what would be synced without making changes')
  .option('--force', 'Overwrite existing files/tests without prompting')
  .action(async (options) => {
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

      const testDir = config.test_directory || './qa-tests';

      if (options.push) {
        await pushToCloud(client, testDir, options.dryRun, options.force);
      } else {
        // Default to pull
        await pullFromCloud(client, testDir, options.dryRun, options.force);
      }
    } catch (err) {
      console.log(error(`Sync failed: ${err}`));
      process.exit(1);
    }
  });

/**
 * Pull tests from cloud to local files
 */
async function pullFromCloud(
  client: ApiClient,
  testDir: string,
  dryRun: boolean = false,
  force: boolean = false
): Promise<void> {
  console.log(info('Fetching tests from cloud...\n'));

  const cloudTests = await client.listTests({ limit: 100 });

  if (cloudTests.length === 0) {
    console.log(warning('No tests found in cloud'));
    return;
  }

  console.log(`Found ${cloudTests.length} cloud test(s)\n`);

  // Ensure test directory exists
  if (!dryRun) {
    await fs.mkdir(testDir, { recursive: true });
  }

  let pulled = 0;
  let skipped = 0;

  for (const test of cloudTests) {
    const safeName = test.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const outputPath = path.join(testDir, safeName + '.yaml');

    // Check if file exists
    let exists = false;
    try {
      await fs.access(outputPath);
      exists = true;
    } catch {
      // File doesn't exist
    }

    if (exists && !force) {
      console.log(`  Skip: ${safeName}.yaml (exists, use --force to overwrite)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  Would pull: ${test.name} -> ${outputPath}`);
    } else {
      try {
        const content = await client.exportTest(test.id, 'yaml', true);
        await fs.writeFile(outputPath, content, 'utf-8');
        console.log(success(`  ${safeName}.yaml`));
        pulled++;
      } catch (err) {
        console.log(error(`  Failed to export ${test.name}: ${err}`));
      }
    }
  }

  console.log('');
  if (dryRun) {
    console.log(info(`Dry run complete. Would pull ${cloudTests.length - skipped} test(s).`));
  } else {
    console.log(success(`Pulled ${pulled} test(s), skipped ${skipped}`));
  }
}

/**
 * Push local tests to cloud
 */
async function pushToCloud(
  client: ApiClient,
  testDir: string,
  dryRun: boolean = false,
  _force: boolean = false
): Promise<void> {
  console.log(info(`Loading local tests from ${testDir}...\n`));

  const files = await discoverTests(testDir);

  if (files.length === 0) {
    console.log(warning('No local tests found'));
    console.log('  Run `qa-use test init` to create example tests');
    return;
  }

  console.log(`Found ${files.length} local test(s)\n`);

  // Load all test definitions
  const definitions = [];
  for (const file of files) {
    try {
      const def = await loadTestDefinition(file);
      definitions.push({ file, def });
    } catch (err) {
      console.log(error(`  Failed to load ${file}: ${err}`));
    }
  }

  if (definitions.length === 0) {
    console.log(error('No valid test definitions found'));
    return;
  }

  if (dryRun) {
    console.log(info('Dry run - would push:'));
    for (const { file, def } of definitions) {
      console.log(`  ${def.name || path.basename(file)}`);
    }
    console.log('');
    console.log(info(`Would import ${definitions.length} test(s)`));
    return;
  }

  // Import to cloud
  console.log('Importing to cloud...\n');

  const result = await client.importTestDefinition(
    definitions.map((d) => d.def),
    { upsert: true }
  );

  if (result.success) {
    for (const imported of result.imported) {
      const action = imported.action === 'created' ? 'Created' : 'Updated';
      console.log(success(`  ${action}: ${imported.name} (${imported.id})`));
    }

    console.log('');
    console.log(success(`Pushed ${result.imported.length} test(s)`));
  } else {
    console.log(error('Import failed'));
    for (const err of result.errors) {
      console.log(error(`  ${err.name}: ${err.error}`));
    }
  }
}
