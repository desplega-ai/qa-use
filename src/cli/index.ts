#!/usr/bin/env node

/**
 * QA-Use CLI - Command line interface for test automation
 */

import { Command } from 'commander';
import { createRequire } from 'module';
import { setupCommand } from './commands/setup.js';
import { infoCommand } from './commands/info.js';
import { testCommand } from './commands/test/index.js';
import { mcpCommand } from './commands/mcp.js';
import { browserCommand } from './commands/browser/index.js';
import { installDepsCommand } from './commands/install-deps.js';
import { updateCommand } from './commands/update.js';

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

// Parse command line arguments
program.parse();
