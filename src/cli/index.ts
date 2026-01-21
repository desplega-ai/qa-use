#!/usr/bin/env node

/**
 * QA-Use CLI - Command line interface for test automation
 */

import { Command } from 'commander';
import { setupCommand } from './commands/setup.js';
import { infoCommand } from './commands/info.js';
import { testCommand } from './commands/test/index.js';
import { mcpCommand } from './commands/mcp.js';

// Get version from package.json
const version = '2.0.0';

const program = new Command();

program.name('qa-use').description('QA automation tool for desplega.ai').version(version);

// Register commands
program.addCommand(setupCommand);
program.addCommand(infoCommand);
program.addCommand(testCommand);
program.addCommand(mcpCommand);

// Parse command line arguments
program.parse();
