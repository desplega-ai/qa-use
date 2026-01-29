/**
 * qa-use test sync - Sync local and cloud tests
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import * as yaml from 'yaml';
import { ApiClient } from '../../../../lib/api/index.js';
import type { TestDefinition } from '../../../types/test-definition.js';
import { loadConfig } from '../../lib/config.js';
import { discoverTests, loadTestDefinition } from '../../lib/loader.js';
import { error, info, success, warning } from '../../lib/output.js';

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
  const writtenIds = new Set<string>(); // Track already written tests to avoid duplicates

  for (const test of cloudTests) {
    // Skip if this test was already written as a dependency of another test
    if (writtenIds.has(test.id)) {
      continue;
    }

    if (dryRun) {
      const safeName = test.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      console.log(`  Would pull: ${test.name} -> ${path.join(testDir, `${safeName}.yaml`)}`);
      continue;
    }

    try {
      // Export with dependencies
      const content = await client.exportTest(test.id, 'yaml', true);

      // Parse multi-document YAML to get all tests (deps + main)
      const docs = yaml.parseAllDocuments(content);
      const tests = docs.map((d) => d.toJSON() as TestDefinition);

      // Write each test to its own file
      for (const testDef of tests) {
        // Skip if already written
        if (testDef.id && writtenIds.has(testDef.id)) {
          continue;
        }

        const safeName = (testDef.name || testDef.id || 'unnamed-test')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const outputPath = path.join(testDir, `${safeName}.yaml`);

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
        } else {
          // Serialize individual test (depends_on stays as UUID)
          const testContent = yaml.stringify(testDef);
          await fs.writeFile(outputPath, testContent, 'utf-8');
          console.log(success(`  ${safeName}.yaml`));
          pulled++;
        }

        if (testDef.id) {
          writtenIds.add(testDef.id);
        }
      }
    } catch (err) {
      console.log(error(`  Failed to export ${test.name}: ${err}`));
    }
  }

  console.log('');
  if (dryRun) {
    console.log(info(`Dry run complete. Would pull ${cloudTests.length} test(s).`));
  } else {
    console.log(success(`Pulled ${pulled} test(s), skipped ${skipped}`));
  }
}

/**
 * Update version_hash in a local YAML file
 * @internal Exported for testing
 */
export async function updateLocalVersionHash(filePath: string, versionHash: string): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const doc = yaml.parseDocument(content);
  doc.set('version_hash', versionHash);
  await fs.writeFile(filePath, doc.toString(), 'utf-8');
}

/**
 * Push local tests to cloud
 */
async function pushToCloud(
  client: ApiClient,
  testDir: string,
  dryRun: boolean = false,
  force: boolean = false
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
  const definitions: Array<{ file: string; def: TestDefinition }> = [];
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
    { upsert: true, force }
  );

  if (result.success) {
    const conflictFiles: string[] = [];

    for (const imported of result.imported) {
      switch (imported.action) {
        case 'created':
          console.log(success(`  Created: ${imported.name} (${imported.id})`));
          break;
        case 'updated':
          console.log(success(`  Updated: ${imported.name} (${imported.id})`));
          break;
        case 'unchanged':
          console.log(info(`  Unchanged: ${imported.name}`));
          break;
        case 'conflict': {
          console.log(warning(`  CONFLICT: ${imported.name} - ${imported.message}`));
          // Find the local file for this conflict
          const localDef = definitions.find(
            (d) => d.def.id === imported.id || d.def.name === imported.name
          );
          if (localDef) {
            // Strip extension for cleaner command suggestion
            const relPath = path.relative(testDir, localDef.file);
            const nameWithoutExt = relPath.replace(/\.(yaml|yml|json)$/, '');
            conflictFiles.push(nameWithoutExt);
          }
          break;
        }
        case 'skipped':
          console.log(info(`  Skipped: ${imported.name}`));
          break;
      }
    }

    // Update local files with new version_hash after successful push
    for (const imported of result.imported) {
      if (
        imported.version_hash &&
        (imported.action === 'created' || imported.action === 'updated')
      ) {
        const localDef = definitions.find(
          (d) => d.def.id === imported.id || d.def.name === imported.name
        );
        if (localDef) {
          try {
            await updateLocalVersionHash(localDef.file, imported.version_hash);
          } catch (err) {
            console.log(warning(`  Failed to update version_hash in ${localDef.file}: ${err}`));
          }
        }
      }
    }

    console.log('');

    if (conflictFiles.length > 0) {
      console.log(warning('Conflicts detected. To see differences, run:'));
      for (const file of conflictFiles) {
        console.log(`  qa-use test diff ${file}`);
      }
      console.log('');
      console.log(info('Then use --force to overwrite, or --pull to get latest versions.'));
    }

    console.log(success(`Pushed ${result.imported.length} test(s)`));
  } else {
    console.log(error('Import failed'));
    for (const err of result.errors) {
      console.log(error(`  ${err.name}: ${err.error}`));
    }
  }
}
