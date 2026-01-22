/**
 * qa-use test export - Export cloud test to local file
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadConfig } from '../../lib/config.js';
import { error, success, info } from '../../lib/output.js';
import { ApiClient } from '../../../../lib/api/index.js';

export const exportCommand = new Command('export')
  .description('Export a cloud test to a local file')
  .argument('<test-id>', 'Cloud test ID (UUID) to export')
  .option('--format <format>', 'Output format (yaml or json)', 'yaml')
  .option('--output <path>', 'Output file path (default: qa-tests/<test-name>.<format>)')
  .option('--no-deps', 'Exclude dependency tests')
  .option('--stdout', 'Output to stdout instead of file')
  .action(async (testId, options) => {
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

      if (!options.stdout) {
        console.log(info(`Exporting test ${testId}...`));
      }

      // Export from API
      const content = await client.exportTest(testId, options.format, options.deps !== false);

      // Output to stdout if requested
      if (options.stdout) {
        console.log(content);
        return;
      }

      // Determine output path
      let outputPath = options.output;

      if (!outputPath) {
        // Get test info to use name for filename
        try {
          const testInfo = await client.getTest(testId);
          const safeName = testInfo.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          const ext = options.format === 'json' ? '.json' : '.yaml';
          outputPath = path.join(config.test_directory || './qa-tests', safeName + ext);
        } catch {
          // Fall back to using test ID as filename
          const ext = options.format === 'json' ? '.json' : '.yaml';
          outputPath = path.join(config.test_directory || './qa-tests', testId + ext);
        }
      }

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(outputPath, content, 'utf-8');

      console.log(success(`Exported to ${outputPath}`));

      // Show summary
      const lines = content.split('\n').length;
      console.log(`  Format: ${options.format}`);
      console.log(`  Lines: ${lines}`);
      if (options.deps !== false) {
        console.log(`  Dependencies: included`);
      }
    } catch (err) {
      console.log(error(`Export failed: ${err}`));
      process.exit(1);
    }
  });
