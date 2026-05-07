/**
 * qa-use test sync - Sync local tests with cloud
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import * as yaml from 'yaml';
import type { ApiClient } from '../../../../lib/api/index.js';
import type { TestDefinition } from '../../../types/test-definition.js';
import { isUuid, toSafeFilename, toUniqueTestFilename } from '../../../utils/strings.js';
import { createApiClient, loadConfig } from '../../lib/config.js';
import { discoverTests, loadTestDefinition } from '../../lib/loader.js';
import {
  error,
  formatError,
  info,
  printValidationErrors,
  success,
  warning,
} from '../../lib/output.js';

// Parent command
export const syncCommand = new Command('sync').description('Sync local tests with cloud');

// Pull subcommand
const pullCommand = new Command('pull')
  .description('Pull tests from cloud to local')
  .option('--id <uuid>', 'Pull single test by ID')
  .option('--app-config-id <id>', 'Pull tests for specific app config')
  .option('--dry-run', 'Show what would be synced without making changes')
  .option('--force', 'Overwrite existing files without prompting')
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
      const client = createApiClient(config);

      const testDir = config.test_directory || './qa-tests';

      await pullFromCloud(client, testDir, {
        dryRun: options.dryRun,
        force: options.force,
        testId: options.id,
        appConfigId: options.appConfigId,
      });
    } catch (err) {
      console.log(error(`Sync failed: ${formatError(err)}`));
      process.exit(1);
    }
  });

// Push subcommand
const pushCommand = new Command('push')
  .description('Push local tests to cloud')
  .option('--id <uuid>', 'Push single test by ID')
  .option('--all', 'Push all local tests')
  .option('--dry-run', 'Show what would be synced without making changes')
  .option('--force', 'Overwrite cloud tests without version check')
  .action(async (options) => {
    // Require --id or --all
    if (!options.id && !options.all) {
      console.log(error('Must specify --id <uuid> or --all'));
      console.log('  Use --id to push a single test');
      console.log('  Use --all to push all local tests');
      process.exit(1);
    }

    try {
      const config = await loadConfig();

      // Check API key
      if (!config.api_key) {
        console.log(error('API key not configured'));
        console.log('  Run `qa-use setup` to configure');
        process.exit(1);
      }

      // Initialize API client
      const client = createApiClient(config);

      const testDir = config.test_directory || './qa-tests';

      await pushToCloud(client, testDir, {
        dryRun: options.dryRun,
        force: options.force,
        testId: options.id,
      });
    } catch (err) {
      console.log(error(`Sync failed: ${formatError(err)}`));
      process.exit(1);
    }
  });

syncCommand.addCommand(pullCommand);
syncCommand.addCommand(pushCommand);

interface PullOptions {
  dryRun?: boolean;
  force?: boolean;
  testId?: string;
  appConfigId?: string;
}

/**
 * Pull tests from cloud to local files
 */
async function pullFromCloud(
  client: ApiClient,
  testDir: string,
  options: PullOptions = {}
): Promise<void> {
  const { dryRun = false, force = false, testId, appConfigId } = options;

  // Single test by ID
  if (testId) {
    console.log(info(`Fetching test ${testId} from cloud...\n`));

    if (dryRun) {
      console.log(`  Would pull: test ${testId}`);
      console.log('');
      console.log(info('Dry run complete.'));
      return;
    }

    try {
      const content = await client.exportTest(testId, 'yaml', true);
      await writeTestsFromContent(content, testDir, force);
    } catch (err) {
      console.log(error(`Failed to export test ${testId}: ${formatError(err)}`));
      process.exit(1);
    }
    return;
  }

  // List tests with optional app_config_id filter
  console.log(info('Fetching tests from cloud...\n'));

  const listOptions: { limit: number; app_config_id?: string } = { limit: 100 };
  if (appConfigId) {
    listOptions.app_config_id = appConfigId;
    console.log(info(`Filtering by app config: ${appConfigId}\n`));
  }

  const cloudTests = await client.listTests(listOptions);

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
      const slug = toUniqueTestFilename(test.name, test.id);
      console.log(`  Would pull: ${test.name} -> ${path.join(testDir, `${slug}.yaml`)}`);
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

        const slug = toUniqueTestFilename(testDef.name || testDef.id || '', testDef.id);
        const outputPath = path.join(testDir, `${slug}.yaml`);

        // Check if file exists
        let exists = false;
        try {
          await fs.access(outputPath);
          exists = true;
        } catch {
          // File doesn't exist
        }

        if (exists && !force) {
          console.log(`  Skip: ${slug}.yaml (exists, use --force to overwrite)`);
          skipped++;
        } else {
          // Serialize individual test (depends_on stays as UUID)
          const testContent = yaml.stringify(testDef);
          await fs.writeFile(outputPath, testContent, 'utf-8');
          console.log(success(`  ${slug}.yaml`));
          pulled++;
        }

        // Warn about orphaned legacy files (un-suffixed slug from older qa-use
        // versions). Names can collide across rows — the legacy file may
        // represent a different test entirely. We never auto-delete; the user
        // disambiguates by inspecting the `id` field.
        if (testDef.id) {
          await warnLegacyOrphan(testDir, testDef.name || testDef.id, testDef.id);
        }

        if (testDef.id) {
          writtenIds.add(testDef.id);
        }
      }
    } catch (err) {
      console.log(error(`  Failed to export ${test.name}: ${formatError(err)}`));
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
 * Warn about a legacy un-suffixed file from older qa-use versions.
 *
 * Pre-name-collision-fix versions wrote `${safeName}.yaml`. Now we always
 * write `${safeName}-${shortId}.yaml`. After a fresh pull, the legacy file
 * is left in place — it may belong to this test, or to a different test
 * with the same name. We never auto-delete; we just nudge the user to
 * inspect and clean up. Read the local file's `id` to make the message
 * actionable.
 */
async function warnLegacyOrphan(testDir: string, testName: string, testId: string): Promise<void> {
  const legacySlug = toSafeFilename(testName);
  const legacyPath = path.join(testDir, `${legacySlug}.yaml`);
  const newPath = path.join(testDir, `${toUniqueTestFilename(testName, testId)}.yaml`);
  if (legacyPath === newPath) return;
  try {
    await fs.access(legacyPath);
  } catch {
    return;
  }
  let legacyId: string | undefined;
  try {
    const raw = await fs.readFile(legacyPath, 'utf-8');
    const parsed = yaml.parse(raw) as { id?: string } | null;
    legacyId = parsed?.id;
  } catch {
    // Unreadable / not YAML — still surface the orphan; user decides.
  }
  const ownership =
    legacyId === testId
      ? 'same id — safe to remove'
      : legacyId
        ? `belongs to a different test (${legacyId}) — verify before removing`
        : 'no `id` field — verify before removing';
  console.log(warning(`  Legacy file: ${legacySlug}.yaml (${ownership})`));
}

/**
 * Write tests from YAML content to files
 */
async function writeTestsFromContent(
  content: string,
  testDir: string,
  force: boolean
): Promise<void> {
  // Ensure directory exists
  await fs.mkdir(testDir, { recursive: true });

  // Parse multi-document YAML
  const docs = yaml.parseAllDocuments(content);
  const tests = docs.map((d) => d.toJSON() as TestDefinition);

  let pulled = 0;
  let skipped = 0;

  for (const testDef of tests) {
    const slug = toUniqueTestFilename(testDef.name || testDef.id || '', testDef.id);
    const outputPath = path.join(testDir, `${slug}.yaml`);

    // Check if file exists
    let exists = false;
    try {
      await fs.access(outputPath);
      exists = true;
    } catch {
      // File doesn't exist
    }

    if (exists && !force) {
      console.log(`  Skip: ${slug}.yaml (exists, use --force to overwrite)`);
      skipped++;
    } else {
      const testContent = yaml.stringify(testDef);
      await fs.writeFile(outputPath, testContent, 'utf-8');
      console.log(success(`  ${slug}.yaml`));
      pulled++;
    }

    if (testDef.id) {
      await warnLegacyOrphan(testDir, testDef.name || testDef.id, testDef.id);
    }
  }

  console.log('');
  console.log(success(`Pulled ${pulled} test(s), skipped ${skipped}`));
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

interface PushOptions {
  dryRun?: boolean;
  force?: boolean;
  testId?: string;
}

/**
 * Present-tense verb for dry-run "Would <verb>: <name>" lines.
 *
 * `ImportedTest.action` values are past tense (created, updated…) because
 * they describe what the API would do; for the planning sentence we want the
 * imperative form so it reads grammatically.
 */
export function planVerb(action: string): string {
  switch (action) {
    case 'created':
      return 'create';
    case 'updated':
      return 'update';
    case 'unchanged':
      return 'leave unchanged';
    case 'conflict':
      return 'conflict on';
    case 'skipped':
      return 'skip';
    default:
      return action;
  }
}

/**
 * Push local tests to cloud
 */
async function pushToCloud(
  client: ApiClient,
  testDir: string,
  options: PushOptions = {}
): Promise<void> {
  const { dryRun = false, force = false, testId } = options;

  console.log(info(`Loading local tests from ${testDir}...\n`));

  const files = await discoverTests(testDir);

  if (files.length === 0) {
    console.log(warning('No local tests found'));
    console.log('  Run `qa-use test init` to create example tests');
    return;
  }

  // Load all test definitions
  const definitions: Array<{ file: string; def: TestDefinition }> = [];
  for (const file of files) {
    try {
      const def = await loadTestDefinition(file);
      definitions.push({ file, def });
    } catch (err) {
      console.log(error(`  Failed to load ${file}: ${formatError(err)}`));
    }
  }

  if (definitions.length === 0) {
    console.log(error('No valid test definitions found'));
    return;
  }

  // Filter to single test if --id provided.
  //
  // A UUID-shaped --id is unambiguous (test ids are unique). A name-shaped
  // --id is a convenience: it works only when exactly one local test
  // matches that name. Names can collide by design — if the local test
  // directory has multiple files with the same `name`, refuse the operation
  // and ask the user to disambiguate by UUID.
  let toImport = definitions;
  if (testId) {
    if (isUuid(testId)) {
      toImport = definitions.filter((d) => d.def.id === testId);
    } else {
      toImport = definitions.filter((d) => d.def.name === testId);
      if (toImport.length > 1) {
        console.log(error(`Ambiguous: '${testId}' matches ${toImport.length} local tests by name`));
        for (const d of toImport) {
          const rel = path.relative(testDir, d.file);
          console.log(`  - ${d.def.id ?? '<no-id>'}  (${rel})`);
        }
        console.log('');
        console.log('  Names can collide. Use --id <uuid> to disambiguate.');
        process.exit(1);
      }
    }
    if (toImport.length === 0) {
      console.log(error(`Test not found: ${testId}`));
      console.log('  Searched by ID and name in local test files');
      process.exit(1);
    }
    console.log(`Found ${toImport.length} matching test(s)\n`);
  } else {
    console.log(`Found ${definitions.length} local test(s)\n`);
  }

  if (dryRun) {
    console.log(info('Dry run - validating with cloud (no changes will be persisted)...\n'));
    const dryResult = await client.importTestDefinition(
      toImport.map((d) => d.def),
      { upsert: true, force, dry_run: true }
    );
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

  // Import to cloud
  console.log('Importing to cloud...\n');

  const result = await client.importTestDefinition(
    toImport.map((d) => d.def),
    { upsert: true, force }
  );

  await renderImportResult(result, toImport, testDir);
}

/**
 * Map an imported result entry back to its local file safely.
 *
 * Names can collide within an org by design (Test.matrix is JSONB on a single
 * row, so multiple rows legitimately share a `name`). The previous
 * `id || name` fallback could silently target the wrong local file:
 *
 * 1. **Prefer id-match.** When the local def already has an id, that id is
 *    unambiguous — match on it first.
 * 2. **Fall back to name-match only for brand-new defs.** A first-push def
 *    has no local id; the cloud has assigned one. We can still recover the
 *    mapping via name, but only when exactly one local def with that name
 *    has no id. If two un-id'd locals share a name, we refuse rather than
 *    pick the wrong one.
 *
 * Callers handle the `null` case explicitly (skip conflict-path push, log a
 * warning before version_hash writeback, etc.).
 */
function findLocalForImported(
  imported: { id: string; name: string },
  toImport: ReadonlyArray<{ def: TestDefinition; file: string }>
): { def: TestDefinition; file: string } | null {
  const byId = toImport.find((d) => d.def.id === imported.id);
  if (byId) return byId;
  const candidates = toImport.filter((d) => !d.def.id && d.def.name === imported.name);
  if (candidates.length === 1) return candidates[0];
  return null;
}

/**
 * Render the result of an importTestDefinition call: print per-test action
 * summary, refresh local version_hash, and surface conflicts/errors.
 *
 * Shared between `qa-use test sync push` and `qa-use test create`.
 */
export async function renderImportResult(
  result: import('../../../../lib/api/index.js').ImportResult,
  toImport: Array<{ file: string; def: TestDefinition }>,
  testDir: string
): Promise<void> {
  if (!result.success) {
    console.log(error('Import failed'));
    printValidationErrors(result.errors);
    return;
  }

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
        const localDef = findLocalForImported(imported, toImport);
        if (localDef) {
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
    if (imported.version_hash && (imported.action === 'created' || imported.action === 'updated')) {
      const localDef = findLocalForImported(imported, toImport);
      if (!localDef) {
        console.log(
          warning(
            `  Could not unambiguously map imported '${imported.name}' back to a local file — version_hash not updated. Pull or push by --id <uuid> to resolve.`
          )
        );
        continue;
      }
      try {
        await updateLocalVersionHash(localDef.file, imported.version_hash);
      } catch (err) {
        console.log(
          warning(`  Failed to update version_hash in ${localDef.file}: ${formatError(err)}`)
        );
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
    console.log(info('Then use --force to overwrite, or pull to get latest versions.'));
  }

  console.log(success(`Pushed ${result.imported.length} test(s)`));
}
