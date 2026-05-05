/**
 * qa-use test diff - Compare local test with cloud version
 */

import * as path from 'node:path';
import { Command } from 'commander';
import * as yaml from 'yaml';
import type { TestDefinition } from '../../../types/test-definition.js';
import { createApiClient, loadConfig } from '../../lib/config.js';
import { loadTestDefinition } from '../../lib/loader.js';
import { error, formatError, info } from '../../lib/output.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Simple line-by-line diff display
 */
function showDiff(localYaml: string, cloudYaml: string): { hasChanges: boolean } {
  const localLines = localYaml.split('\n');
  const cloudLines = cloudYaml.split('\n');

  let hasChanges = false;

  // Find max length for alignment
  const maxLines = Math.max(localLines.length, cloudLines.length);

  console.log(`\n${colors.cyan}Local${colors.reset} vs ${colors.cyan}Cloud${colors.reset}`);
  console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}\n`);

  for (let i = 0; i < maxLines; i++) {
    const local = localLines[i] ?? '';
    const cloud = cloudLines[i] ?? '';

    if (local === cloud) {
      // Same line - show in gray
      console.log(`  ${colors.gray}${local}${colors.reset}`);
    } else {
      hasChanges = true;
      // Different - show both with colors
      if (local) {
        console.log(`${colors.red}- ${local}${colors.reset}`);
      }
      if (cloud) {
        console.log(`${colors.green}+ ${cloud}${colors.reset}`);
      }
    }
  }

  console.log('');
  return { hasChanges };
}

/**
 * UUID-v4 shape regex for matrix-id stripping during canonicalization.
 * Auto-generated option ids regenerate on each round-trip; treating them as
 * equivalent prevents spurious diffs when only the auto id changed.
 */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Canonicalize a matrix block for stable structured-diff hashing:
 *   - strip auto-generated UUID-v4 ids (they regenerate on round-trip);
 *     user-supplied non-UUID-shape ids are preserved
 *   - sort var_options within each option by `key`
 *   - sort options by their canonicalized JSON content
 */
function canonicalizeMatrix(matrix: unknown): unknown {
  if (!matrix || typeof matrix !== 'object') return matrix;
  const m = matrix as { max_parallel?: unknown; options?: unknown };
  const optionsIn = Array.isArray(m.options) ? m.options : [];

  const canonOptions = optionsIn.map((rawOpt) => {
    if (!rawOpt || typeof rawOpt !== 'object') return rawOpt;
    const opt = { ...(rawOpt as Record<string, unknown>) };

    // Strip UUID-v4 ids (auto-generated)
    if (typeof opt.id === 'string' && UUID_V4_RE.test(opt.id)) {
      delete opt.id;
    }

    // Sort var_options by key
    if (Array.isArray(opt.var_options)) {
      const sorted = [...opt.var_options].sort((a, b) => {
        const ak =
          a && typeof a === 'object' ? String((a as Record<string, unknown>).key ?? '') : '';
        const bk =
          b && typeof b === 'object' ? String((b as Record<string, unknown>).key ?? '') : '';
        return ak.localeCompare(bk);
      });
      opt.var_options = sorted;
    }
    return opt;
  });

  // Sort options by canonicalized JSON content
  canonOptions.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return { max_parallel: m.max_parallel ?? null, options: canonOptions };
}

/**
 * Show key field differences in a structured way
 */
function showFieldDiff(local: TestDefinition, cloud: TestDefinition): void {
  const fieldsToCompare = [
    'name',
    'description',
    'url',
    'app_config',
    'tags',
    'depends_on',
    'variables',
    'matrix',
  ] as const;

  console.log(`${colors.cyan}Field Comparison:${colors.reset}`);
  console.log(`${colors.gray}${'─'.repeat(40)}${colors.reset}`);

  let hasDiff = false;

  for (const field of fieldsToCompare) {
    const rawLocal = (local as Record<string, unknown>)[field] ?? null;
    const rawCloud = (cloud as Record<string, unknown>)[field] ?? null;
    // Matrix: hash via canonical form so auto-UUID-id churn + var_options
    // ordering don't trip the diff.
    const normLocal = field === 'matrix' ? canonicalizeMatrix(rawLocal) : rawLocal;
    const normCloud = field === 'matrix' ? canonicalizeMatrix(rawCloud) : rawCloud;
    const localVal = JSON.stringify(normLocal);
    const cloudVal = JSON.stringify(normCloud);

    if (localVal !== cloudVal) {
      hasDiff = true;
      console.log(`\n  ${colors.yellow}${field}:${colors.reset}`);
      console.log(`    ${colors.red}local:${colors.reset} ${localVal}`);
      console.log(`    ${colors.green}cloud:${colors.reset} ${cloudVal}`);
    }
  }

  // Compare step counts
  const localSteps = local.steps?.length ?? 0;
  const cloudSteps = cloud.steps?.length ?? 0;
  if (localSteps !== cloudSteps) {
    hasDiff = true;
    console.log(`\n  ${colors.yellow}steps:${colors.reset}`);
    console.log(`    ${colors.red}local:${colors.reset} ${localSteps} steps`);
    console.log(`    ${colors.green}cloud:${colors.reset} ${cloudSteps} steps`);
  }

  // Compare version hashes
  const localHash = (local as Record<string, unknown>).version_hash as string | undefined;
  const cloudHash = (cloud as Record<string, unknown>).version_hash as string | undefined;
  console.log(`\n  ${colors.yellow}version_hash:${colors.reset}`);
  console.log(`    ${colors.red}local:${colors.reset} ${localHash ?? '(none)'}`);
  console.log(`    ${colors.green}cloud:${colors.reset} ${cloudHash ?? '(none)'}`);

  if (!hasDiff) {
    console.log(`\n  ${colors.green}No differences in key fields${colors.reset}`);
  }

  console.log('');
}

export const diffCommand = new Command('diff')
  .description('Compare local test with cloud version')
  .argument('<file>', 'Local test file path')
  .option('--full', 'Show full YAML diff (default: field comparison)')
  .action(async (file, options) => {
    try {
      const config = await loadConfig();

      // Check API key
      if (!config.api_key) {
        console.log(error('API key not configured'));
        console.log('  Run `qa-use setup` to configure');
        process.exit(1);
      }

      // Load local test
      const testDir = config.test_directory || './qa-tests';
      let filePath = path.isAbsolute(file) ? file : path.join(testDir, file);

      // Try with extensions if file doesn't have one
      const extensions = ['.yaml', '.yml', '.json'];
      const hasExtension = extensions.some((ext) => file.endsWith(ext));

      let localTest: TestDefinition | null = null;
      const triedPaths: string[] = [];

      if (hasExtension) {
        triedPaths.push(filePath);
        try {
          localTest = await loadTestDefinition(filePath);
        } catch {
          // Will show error below
        }
      } else {
        // Try each extension
        for (const ext of extensions) {
          const tryPath = filePath + ext;
          triedPaths.push(tryPath);
          try {
            localTest = await loadTestDefinition(tryPath);
            filePath = tryPath;
            break;
          } catch {
            // Try next extension
          }
        }
      }

      if (!localTest) {
        console.log(error(`Failed to load local test: ${file}`));
        console.log(`  Tried: ${triedPaths.join(', ')}`);
        process.exit(1);
      }

      // Check if test has an ID
      if (!localTest.id) {
        console.log(error('Local test has no ID - cannot compare with cloud'));
        console.log('  Push the test first with: qa-use test sync --push');
        process.exit(1);
      }

      console.log(info(`Comparing local test with cloud version...`));
      console.log(`  Local: ${path.relative(process.cwd(), filePath)}`);
      console.log(`  Cloud: ${localTest.id}`);

      // Fetch cloud version
      const client = createApiClient(config);

      let cloudYaml: string;
      try {
        cloudYaml = await client.exportTest(localTest.id, 'yaml', false);
      } catch {
        console.log(error(`Test not found in cloud: ${localTest.id}`));
        process.exit(1);
      }

      const cloudTest = yaml.parse(cloudYaml) as TestDefinition;

      if (options.full) {
        // Full YAML diff
        const localYaml = yaml.stringify(localTest);
        const { hasChanges } = showDiff(localYaml, cloudYaml);

        if (!hasChanges) {
          console.log(info('No differences found'));
        }
      } else {
        // Structured field comparison
        showFieldDiff(localTest, cloudTest);
      }
    } catch (err) {
      console.log(error(`Failed to diff: ${formatError(err)}`));
      process.exit(1);
    }
  });
