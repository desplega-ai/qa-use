/**
 * qa-use test export - Export cloud test to local file
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import * as yaml from 'yaml';
import { ApiClient } from '../../../../lib/api/index.js';
import type { TestDefinition } from '../../../types/test-definition.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, info, success, warning } from '../../lib/output.js';
import { toSafeFilename } from '../../../utils/strings.js';

export const exportCommand = new Command('export')
  .description('Export a cloud test to a local file')
  .argument('<test-id>', 'Cloud test ID (UUID) to export')
  .option('--format <format>', 'Output format (yaml or json)', 'yaml')
  .option('--output <path>', 'Output file path (default: qa-tests/<test-name>.<format>)')
  .option('--no-deps', 'Exclude dependency tests')
  .option('--stdout', 'Output to stdout instead of file')
  .action(async (testId, options) => {
    // Deprecation warning
    console.log(warning('The "export" command is deprecated. Use "qa-use test sync pull --id <test-id>" instead.'));
    console.log('');

    try {
      const config = await loadConfig();

      // Check API key
      if (!config.api_key) {
        console.log(error('API key not configured'));
        console.log('  Run `qa-use setup` to configure');
        process.exit(1);
      }

      // Validate format
      if (!['yaml', 'json'].includes(options.format)) {
        console.log(error('Invalid format. Use --format yaml or --format json'));
        process.exit(1);
      }

      // Initialize API client
      const client = new ApiClient(config.api_url);
      client.setApiKey(config.api_key);

      const includeDeps = options.deps !== false;

      if (!options.stdout) {
        console.log(info(`Exporting test ${testId}...`));
      }

      // Export from API
      const content = await client.exportTest(testId, options.format, includeDeps);

      // Output to stdout if requested (all tests concatenated)
      if (options.stdout) {
        console.log(content);
        return;
      }

      const testDir = config.test_directory || './qa-tests';

      // Ensure directory exists
      await fs.mkdir(testDir, { recursive: true });

      // Parse tests from content
      let tests: TestDefinition[];
      if (options.format === 'json') {
        const parsed = JSON.parse(content);
        tests = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        // Parse multi-document YAML
        const docs = yaml.parseAllDocuments(content);
        tests = docs.map((d) => d.toJSON() as TestDefinition);
      }

      // If explicit output path provided, write single file (backward compat for single test)
      if (options.output) {
        const dir = path.dirname(options.output);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(options.output, content, 'utf-8');
        console.log(success(`Exported to ${options.output}`));
        console.log(`  Format: ${options.format}`);
        console.log(`  Tests: ${tests.length}`);
        return;
      }

      // Write each test to its own file
      const ext = options.format === 'json' ? '.json' : '.yaml';
      const written: string[] = [];

      for (const test of tests) {
        const safeName = toSafeFilename(test.name || test.id || '');
        const outputPath = path.join(testDir, safeName + ext);

        // Serialize individual test (depends_on stays as UUID)
        const testContent =
          options.format === 'json' ? JSON.stringify(test, null, 2) : yaml.stringify(test);

        await fs.writeFile(outputPath, testContent, 'utf-8');
        written.push(outputPath);
      }

      // Show summary
      console.log(success(`Exported ${written.length} test(s):`));
      for (const file of written) {
        console.log(`  - ${file}`);
      }
      console.log(`  Format: ${options.format}`);
      if (includeDeps && tests.length > 1) {
        console.log(`  Dependencies: ${tests.length - 1} included`);
      }
    } catch (err) {
      console.log(error(`Export failed: ${formatError(err)}`));
      process.exit(1);
    }
  });
