/**
 * qa-use test init - Initialize test directory with examples
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import { loadConfig } from '../../lib/config.js';
import { error, success } from '../../lib/output.js';

const EXAMPLE_TEST = `# Example test definition
name: Example Test
app_config: your-app-config-id-here
variables:
  email: test@example.com
  password: secret123
steps:
  - action: goto
    url: /
  - action: fill
    target: email input
    value: $email
  - action: fill
    target: password input
    value: $password
  - action: click
    target: login button
  - action: to_be_visible
    target: dashboard
`;

export const initCommand = new Command('init')
  .description('Initialize test directory with example files')
  .action(async () => {
    try {
      const config = await loadConfig();
      const testDir = config.test_directory || './qa-tests';

      // Create directory if it doesn't exist
      try {
        await fs.mkdir(testDir, { recursive: true });
        console.log(success(`Created directory: ${testDir}`));
      } catch {
        console.log(`Directory ${testDir} already exists`);
      }

      // Create example test file
      const examplePath = path.join(testDir, 'example.yaml');
      try {
        await fs.access(examplePath);
        console.log(`File ${examplePath} already exists, skipping`);
      } catch {
        await fs.writeFile(examplePath, EXAMPLE_TEST, 'utf-8');
        console.log(success(`Created: ${examplePath}`));
      }

      console.log('\n✓ Initialization complete!');
      console.log('\nNext steps:');
      console.log('  1. Edit example.yaml with your app config ID');
      console.log('  2. Run: qa-use test validate example');
      console.log('  3. Run: qa-use test run example');
    } catch (err) {
      console.log(error(`Initialization failed: ${err}`));
      process.exit(1);
    }
  });
