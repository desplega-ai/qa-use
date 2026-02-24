#!/usr/bin/env node

/**
 * QA-Use CLI - Command line interface for test automation
 */

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { browserCommand } from './commands/browser/index.js';
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

program.name('qa-use').description('QA automation tool for desplega.ai').version(version);

// Register commands
program.addCommand(setupCommand);
program.addCommand(infoCommand);
program.addCommand(testCommand);
program.addCommand(mcpCommand);
program.addCommand(browserCommand);
program.addCommand(installDepsCommand);
program.addCommand(updateCommand);

// Auto-update hint (reads from cache, fires async fetch — never blocks)
if (!shouldSkipCheck(process.argv)) {
  showUpdateHintIfAvailable(version);
  checkForUpdateAsync();
}

// Show update notice in --help output
program.addHelpText('after', () => getUpdateHintForHelp(version));

// Parse command line arguments
program.parse();
