#!/usr/bin/env node

/**
 * QA-Use CLI - Command line interface for test automation
 */

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { apiCommand } from './commands/api/index.js';
import { appConfigCommand } from './commands/app-config/index.js';
import { appContextCommand } from './commands/app-context/index.js';
import { browserCommand } from './commands/browser/index.js';
import { dataAssetCommand } from './commands/data-asset/index.js';
import { docsCommand } from './commands/docs.js';
import { doctorCommand } from './commands/doctor.js';
import { infoCommand } from './commands/info.js';
import { installDepsCommand } from './commands/install-deps.js';
import { issuesCommand } from './commands/issues/index.js';
import { mcpCommand } from './commands/mcp.js';
import { personaCommand } from './commands/persona/index.js';
import { setupCommand } from './commands/setup.js';
import { suiteCommand } from './commands/suite/index.js';
import { testCommand } from './commands/test/index.js';
import { tunnelCommand } from './commands/tunnel/index.js';
import { updateCommand } from './commands/update.js';
import { usageCommand } from './commands/usage.js';
import { kickoffStartupSweep } from './lib/startup-sweep.js';
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
program.addCommand(suiteCommand);
program.addCommand(mcpCommand);
program.addCommand(browserCommand);
program.addCommand(tunnelCommand());
program.addCommand(installDepsCommand);
program.addCommand(updateCommand);
program.addCommand(apiCommand);
program.addCommand(appConfigCommand);
program.addCommand(appContextCommand);
program.addCommand(personaCommand);
program.addCommand(dataAssetCommand);
program.addCommand(issuesCommand);
program.addCommand(usageCommand);
program.addCommand(doctorCommand);

// Bounded startup sweep — reaps orphaned PID files silently. Budget-capped
// at 250 ms, skips itself when `doctor` or `__browser-detach` is running.
kickoffStartupSweep();

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
  Runs:      test runs list, test runs info, test runs steps
  Suites:    suite list, suite create, suite run
  Issues:    issues list, issues info, issues occurrences
  Browser:   browser create, browser goto, browser snapshot, browser click
  Config:    app-config list, app-config create
  Context:   app-context list, app-context create
  Personas:  persona list, persona create
  Assets:    data-asset list, data-asset upload
  Usage:     usage, usage --detailed
  API:       api ls, api info, api examples, api openapi
  Docs:      docs, docs <topic>, docs --list
  Advanced:  mcp

Common Workflows:
  # Verify a feature in the browser
  qa-use browser create --no-headless https://your-app.com
  qa-use browser snapshot
  qa-use browser click <ref>
  qa-use browser close

  # Create and run a test
  qa-use test init
  qa-use test run example-test

  # Explore and call API endpoints
  qa-use api ls
  qa-use api info /api/v1/tests
  qa-use api /api/v1/tests -f limit=5

  # Record a flow and generate a test
  qa-use browser create
  qa-use browser goto https://your-app.com
  qa-use browser click <ref>
  qa-use browser generate-test my-test

  # Manage test suites
  qa-use suite create -F name="Smoke Tests"
  qa-use suite list
  qa-use suite run <suite-id>

  # Review test run results
  qa-use test runs list --limit 5
  qa-use test runs info <run-id>
  qa-use test runs steps <run-id>

  # Check issues and usage
  qa-use issues list --limit 10
  qa-use usage --detailed

  # Get help on writing tests
  qa-use docs test-format
${updateHint}`;
});

// Parse command line arguments
program.parse();
