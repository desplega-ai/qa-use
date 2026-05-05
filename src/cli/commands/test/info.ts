/**
 * qa-use test info - Show test definition details
 */

import * as path from 'node:path';
import { Command } from 'commander';
import * as yaml from 'yaml';
import type { TestDefinition } from '../../../types/test-definition.js';
import { apiCall, requireApiKey } from '../../lib/api-helpers.js';
import { createApiClient, loadConfig } from '../../lib/config.js';
import { discoverTests, loadTestDefinition } from '../../lib/loader.js';
import { error, formatError, info } from '../../lib/output.js';
import { formatStatus, formatTimestamp } from '../../lib/table.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

interface MatrixVarOption {
  key?: string;
  value?: string | number;
  is_sensitive?: boolean;
}

interface MatrixOption {
  id?: string | null;
  is_default?: boolean;
  var_options?: MatrixVarOption[];
  timeout_override?: number | null;
}

interface MatrixDefinition {
  max_parallel?: number | null;
  options?: MatrixOption[];
}

/**
 * Render the Matrix summary block when a test has matrix options.
 * Sensitive var_options are masked as ****; auto-UUID ids show as <auto-uuid>.
 */
function displayMatrixSummary(matrix: MatrixDefinition | null | undefined): void {
  if (!matrix?.options || matrix.options.length === 0) return;

  const opts = matrix.options;
  const headerExtras: string[] = [];
  if (typeof matrix.max_parallel === 'number') {
    headerExtras.push(`max_parallel: ${matrix.max_parallel}`);
  }
  const headerSuffix = headerExtras.length > 0 ? ` (${headerExtras.join(', ')})` : '';
  console.log(`  Matrix:      ${opts.length} options${headerSuffix}`);

  // Determine label width — pick the longest of the rendered ids/labels so
  // the var-options column lines up.
  const renderId = (opt: MatrixOption): string => {
    if (opt.is_default) return 'default';
    const id = typeof opt.id === 'string' ? opt.id : '';
    if (!id) return '<auto-uuid>';
    return UUID_RE.test(id) ? '<auto-uuid>' : id;
  };
  const labelWidth = Math.max(...opts.map((o) => renderId(o).length));

  for (const opt of opts) {
    const idLabel = renderId(opt).padEnd(labelWidth);
    const pairs = (opt.var_options ?? []).map((vo) => {
      const k = vo.key ?? '?';
      const v = vo.is_sensitive ? '****' : String(vo.value ?? '');
      return `${k}=${v}`;
    });
    const pairsStr =
      pairs.length > 0 ? pairs.join(', ') : `${colors.gray}(no overrides)${colors.reset}`;
    console.log(`    ${colors.gray}↳${colors.reset} ${idLabel}  ${pairsStr}`);
  }
}

/**
 * Format a test definition for display (local mode)
 */
function displayTestInfo(test: TestDefinition, source: string): void {
  console.log(`\n${colors.cyan}Test: ${test.name}${colors.reset}`);
  console.log(`${colors.gray}${'─'.repeat(40)}${colors.reset}`);

  // ID
  if (test.id) {
    console.log(`  ID:          ${test.id}`);
  }

  // Source
  console.log(`  Source:      ${source}`);

  // Description
  if (test.description) {
    console.log(`  Description: ${test.description}`);
  }

  // Tags
  if (test.tags && test.tags.length > 0) {
    console.log(`  Tags:        ${test.tags.join(', ')}`);
  }

  // App config
  if (test.app_config) {
    console.log(`  App Config:  ${test.app_config}`);
  }

  // Dependencies
  if (test.depends_on) {
    console.log(`  Depends On:  ${test.depends_on}`);
  }

  // Variables — flexible shape: simple `string | number` or full `VariableEntry`.
  // Sensitive entries (full form, is_sensitive=true) display masked.
  if (test.variables && Object.keys(test.variables).length > 0) {
    console.log('  Variables:');
    for (const [key, value] of Object.entries(test.variables)) {
      let raw: string;
      if (value && typeof value === 'object') {
        const v = value as { value?: string | number; is_sensitive?: boolean };
        raw = v.is_sensitive ? '****' : String(v.value ?? '');
      } else {
        raw = String(value ?? '');
      }
      const displayValue = raw.length > 50 ? `${raw.substring(0, 47)}...` : raw;
      console.log(`    ${key}: ${colors.gray}${displayValue}${colors.reset}`);
    }
  }

  // Matrix summary
  displayMatrixSummary((test as { matrix?: MatrixDefinition | null }).matrix);

  // Steps summary
  if (test.steps && test.steps.length > 0) {
    console.log(`  Steps:       ${test.steps.length}`);
    for (let i = 0; i < test.steps.length; i++) {
      const step = test.steps[i];
      const action = step.type === 'extended' ? step.action?.action : step.action;
      const target =
        step.type === 'extended'
          ? step.name || step.locator?.text
          : (step as any).target || (step as any).url;
      const targetStr = target ? ` ${colors.gray}→ ${target}${colors.reset}` : '';
      console.log(`    [${i + 1}] ${action}${targetStr}`);
    }
  }

  console.log('');
}

/**
 * Display cloud test detail from /api/v1/tests/{id} response.
 */
function displayCloudTestInfo(data: Record<string, unknown>): void {
  const name = String(data.name ?? 'Unnamed');
  console.log(`\n${colors.cyan}Test: ${name}${colors.reset}`);
  console.log(`${colors.gray}${'─'.repeat(40)}${colors.reset}`);

  console.log(`  ID:          ${String(data.id ?? '-')}`);
  console.log(`  Source:      cloud`);

  if (data.description) {
    console.log(`  Description: ${String(data.description)}`);
  }

  if (data.status) {
    console.log(`  Status:      ${formatStatus(String(data.status))}`);
  }

  if (Array.isArray(data.tags) && data.tags.length > 0) {
    console.log(`  Tags:        ${data.tags.join(', ')}`);
  }

  if (data.app_config) {
    console.log(`  App Config:  ${String(data.app_config)}`);
  }

  if (data.created_at) {
    console.log(`  Created:     ${formatTimestamp(String(data.created_at))}`);
  }

  if (data.updated_at) {
    console.log(`  Updated:     ${formatTimestamp(String(data.updated_at))}`);
  }

  // Last run info
  if (data.last_run && typeof data.last_run === 'object') {
    const run = data.last_run as Record<string, unknown>;
    console.log('  Last Run:');
    if (run.id) console.log(`    Run ID:    ${String(run.id)}`);
    if (run.status) console.log(`    Status:    ${formatStatus(String(run.status))}`);
    if (run.started_at) console.log(`    Started:   ${formatTimestamp(String(run.started_at))}`);
    if (run.finished_at) console.log(`    Finished:  ${formatTimestamp(String(run.finished_at))}`);
  }

  // Variables — accept simple value or full `{value, is_sensitive}` entry.
  if (data.variables && typeof data.variables === 'object') {
    const vars = data.variables as Record<string, unknown>;
    const keys = Object.keys(vars);
    if (keys.length > 0) {
      console.log('  Variables:');
      for (const [key, value] of Object.entries(vars)) {
        let raw: string;
        if (value && typeof value === 'object') {
          const v = value as { value?: string | number; is_sensitive?: boolean };
          raw = v.is_sensitive ? '****' : String(v.value ?? '');
        } else {
          raw = String(value ?? '');
        }
        const displayValue = raw.length > 50 ? `${raw.substring(0, 47)}...` : raw;
        console.log(`    ${key}: ${colors.gray}${displayValue}${colors.reset}`);
      }
    }
  }

  // Matrix summary (cloud data may shape it as `{options: [...]}`)
  displayMatrixSummary(data.matrix as MatrixDefinition | null | undefined);

  // Steps summary
  if (Array.isArray(data.steps) && data.steps.length > 0) {
    console.log(`  Steps:       ${data.steps.length}`);
    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i] as Record<string, unknown>;
      const action = step.action ?? step.type ?? '?';
      const target = step.name || step.url || '';
      const targetStr = target ? ` ${colors.gray}→ ${String(target)}${colors.reset}` : '';
      console.log(`    [${i + 1}] ${String(action)}${targetStr}`);
    }
  }

  console.log('');
}

export const infoCommand = new Command('info')
  .description(
    `Show test definition details.

For local tests, provide the test name (relative to test directory):
  qa-use test info auth/login

For cloud tests, provide the UUID:
  qa-use test info 550e8400-e29b-41d4-a716-446655440000`
  )
  .argument('[id-or-name]', 'Test name (local) or UUID (cloud)')
  .option('--id <id>', 'Cloud test ID (UUID) - fetches from cloud (backward compat)')
  .option('--format <format>', 'Output format: pretty (default), yaml, json', 'pretty')
  .option('--json', 'Output raw JSON (shorthand for --format json)')
  .action(async (idOrName, options) => {
    try {
      const config = await loadConfig();

      // Resolve the effective format
      const format = options.json ? 'json' : options.format;

      // Determine the lookup key: --id takes precedence, then positional arg
      const lookupKey: string | undefined = options.id || idOrName;

      if (!lookupKey) {
        console.log(error('Please provide a test name or UUID'));
        console.log('  Usage: qa-use test info <name-or-uuid>');
        console.log('         qa-use test info --id <uuid>');
        process.exit(1);
      }

      // Auto-detect: if it looks like a UUID, fetch from cloud
      const isUuid = options.id !== undefined || UUID_RE.test(lookupKey);

      if (isUuid) {
        // Cloud mode
        requireApiKey(config);
        const testId = lookupKey;

        console.error(info(`Fetching test ${testId} from cloud...`));

        let cloudData: Record<string, unknown> | null = null;

        try {
          cloudData = (await apiCall(config, 'GET', `/api/v1/tests/${testId}`)) as Record<
            string,
            unknown
          >;
        } catch {
          // API call failed — fall back to export
        }

        if (cloudData) {
          // Rich cloud detail
          if (format === 'json') {
            console.log(JSON.stringify(cloudData, null, 2));
          } else if (format === 'yaml') {
            console.log(yaml.stringify(cloudData));
          } else {
            displayCloudTestInfo(cloudData);
          }
          return;
        }

        // Fallback: use legacy client export
        const client = createApiClient(config);
        const content = await client.exportTest(testId, 'yaml', false);
        const test = yaml.parse(content) as TestDefinition;
        const source = `cloud (${testId})`;

        if (format === 'json') {
          console.log(JSON.stringify(test, null, 2));
        } else if (format === 'yaml') {
          console.log(yaml.stringify(test));
        } else {
          displayTestInfo(test, source);
        }
      } else {
        // Local mode
        const testDir = config.test_directory || './qa-tests';
        const files = await discoverTests(testDir);

        // Find matching test file
        const resolvedTestDir = path.resolve(testDir);
        let matchedFile: string | null = null;

        for (const file of files) {
          const relativePath = path
            .relative(resolvedTestDir, file)
            .replace(/\.(yaml|yml|json)$/, '');

          if (relativePath === lookupKey || path.basename(relativePath) === lookupKey) {
            matchedFile = file;
            break;
          }
        }

        if (!matchedFile) {
          // Try with extensions
          for (const file of files) {
            if (
              file.endsWith(lookupKey) ||
              file.endsWith(`${lookupKey}.yaml`) ||
              file.endsWith(`${lookupKey}.yml`) ||
              file.endsWith(`${lookupKey}.json`)
            ) {
              matchedFile = file;
              break;
            }
          }
        }

        if (!matchedFile) {
          console.log(error(`Test not found: ${lookupKey}`));
          console.log(`  Searched in: ${testDir}`);
          process.exit(1);
        }

        const test = await loadTestDefinition(matchedFile);
        const relPath = path.relative(process.cwd(), matchedFile);
        const source = `${relPath} (local file)`;

        if (format === 'json') {
          console.log(JSON.stringify(test, null, 2));
        } else if (format === 'yaml') {
          console.log(yaml.stringify(test));
        } else {
          displayTestInfo(test, source);
        }
      }
    } catch (err) {
      console.log(error(`Failed to get test info: ${formatError(err)}`));
      process.exit(1);
    }
  });
