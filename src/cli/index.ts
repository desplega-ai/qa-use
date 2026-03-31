#!/usr/bin/env node

/**
 * QA-Use CLI - Command line interface for test automation
 */

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { apiCommand } from './commands/api/index.js';
import { browserCommand } from './commands/browser/index.js';
import { docsCommand } from './commands/docs.js';
import { infoCommand } from './commands/info.js';
import { installDepsCommand } from './commands/install-deps.js';
import { mcpCommand } from './commands/mcp.js';
import { setupCommand } from './commands/setup.js';
import { testCommand } from './commands/test/index.js';
import { updateCommand } from './commands/update.js';
import {
  checkForUpdateAsync,
  getUpdateHintForHelp,
  shouldSkipCheck,
  showUpdateHintIfAvailable,
} from './lib/update-check.js';

// Get version from package.json
const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

const program = new Command();

program
  .name('qa-use')
  .description('QA automation and browser testing CLI for desplega.ai')
  .version(version);

// Register commands
program.addCommand(setupCommand);
program.addCommand(infoCommand);
program.addCommand(docsCommand);
program.addCommand(testCommand);
program.addCommand(mcpCommand);
program.addCommand(browserCommand);
program.addCommand(installDepsCommand);
program.addCommand(updateCommand);
program.addCommand(apiCommand);

// Auto-update hint (reads from cache, fires async fetch — never blocks)
if (!shouldSkipCheck(process.argv)) {
  showUpdateHintIfAvailable(version);
  checkForUpdateAsync();
}

// Getting started guide before the standard help
program.addHelpText(
  'before',
  `
Getting Started:
  1. qa-use setup --api-key <key>   Configure authentication
  2. qa-use install-deps            Install browser (Chromium)
  3. qa-use docs                    Read full documentation
  4. qa-use test init               Create example test
  5. qa-use test run <name>         Run your first test
`
);

// Workflow examples and command grouping after the standard help
program.addHelpText('after', () => {
  const updateHint = getUpdateHintForHelp(version);
  return `
Command Groups:
  Setup:     setup, info, install-deps, update
  Testing:   test run, test list, test validate, test init
  Browser:   browser create, browser goto, browser snapshot, browser click
  Docs:      docs, docs <topic>, docs --list
  Advanced:  mcp, api

Common Workflows:
  # Verify a feature in the browser
  qa-use browser create --no-headless https://your-app.com
  qa-use browser snapshot
  qa-use browser click <ref>
  qa-use browser close

  # Create and run a test
  qa-use test init
  qa-use test run example-test

  # Record a flow and generate a test
  qa-use browser create
  qa-use browser goto https://your-app.com
  qa-use browser click <ref>
  qa-use browser generate-test my-test

  # Get help on writing tests
  qa-use docs test-format
${updateHint}`;
});

// Parse command line arguments
program.parse();
