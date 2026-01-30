/**
 * qa-use test info - Show test definition details
 */

import * as path from 'node:path';
import { Command } from 'commander';
import * as yaml from 'yaml';
import { ApiClient } from '../../../../lib/api/index.js';
import type { TestDefinition } from '../../../types/test-definition.js';
import { loadConfig } from '../../lib/config.js';
import { discoverTests, loadTestDefinition } from '../../lib/loader.js';
import { error, formatError, info } from '../../lib/output.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

/**
 * Format a test definition for display
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

  // Variables
  if (test.variables && Object.keys(test.variables).length > 0) {
    console.log(`  Variables:`);
    for (const [key, value] of Object.entries(test.variables)) {
      const displayValue = value.length > 50 ? `${value.substring(0, 47)}...` : value;
      console.log(`    ${key}: ${colors.gray}${displayValue}${colors.reset}`);
    }
  }

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

export const infoCommand = new Command('info')
  .description('Show test definition details')
  .argument('[name]', 'Local test name/path (relative to test directory)')
  .option('--id <id>', 'Cloud test ID (UUID) - fetches from cloud')
  .option('--format <format>', 'Output format: pretty (default), yaml, json', 'pretty')
  .action(async (name, options) => {
    try {
      const config = await loadConfig();

      // Must provide either name or --id
      if (!name && !options.id) {
        console.log(error('Please provide a test name or use --id <uuid> for cloud tests'));
        console.log('  Usage: qa-use test info <name>');
        console.log('         qa-use test info --id <uuid>');
        process.exit(1);
      }

      let test: TestDefinition;
      let source: string;

      if (options.id) {
        // Fetch from cloud
        if (!config.api_key) {
          console.log(error('API key not configured'));
          console.log('  Run `qa-use setup` to configure');
          process.exit(1);
        }

        const client = new ApiClient(config.api_url);
        client.setApiKey(config.api_key);

        console.log(info(`Fetching test ${options.id} from cloud...`));

        // Use export to get full definition (including steps)
        const content = await client.exportTest(options.id, 'yaml', false);
        test = yaml.parse(content) as TestDefinition;
        source = `cloud (${options.id})`;
      } else {
        // Load local test
        const testDir = config.test_directory || './qa-tests';
        const files = await discoverTests(testDir);

        // Find matching test file
        const resolvedTestDir = path.resolve(testDir);
        let matchedFile: string | null = null;

        for (const file of files) {
          const relativePath = path
            .relative(resolvedTestDir, file)
            .replace(/\.(yaml|yml|json)$/, '');

          if (relativePath === name || path.basename(relativePath) === name) {
            matchedFile = file;
            break;
          }
        }

        if (!matchedFile) {
          // Try with extensions
          for (const file of files) {
            if (
              file.endsWith(name) ||
              file.endsWith(`${name}.yaml`) ||
              file.endsWith(`${name}.yml`) ||
              file.endsWith(`${name}.json`)
            ) {
              matchedFile = file;
              break;
            }
          }
        }

        if (!matchedFile) {
          console.log(error(`Test not found: ${name}`));
          console.log(`  Searched in: ${testDir}`);
          process.exit(1);
        }

        test = await loadTestDefinition(matchedFile);
        source = path.relative(process.cwd(), matchedFile);
      }

      // Output based on format
      if (options.format === 'yaml') {
        console.log(yaml.stringify(test));
      } else if (options.format === 'json') {
        console.log(JSON.stringify(test, null, 2));
      } else {
        displayTestInfo(test, source);
      }
    } catch (err) {
      console.log(error(`Failed to get test info: ${formatError(err)}`));
      process.exit(1);
    }
  });
