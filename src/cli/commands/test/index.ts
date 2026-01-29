/**
 * qa-use test - Test management command group
 */

import { Command } from 'commander';
import { diffCommand } from './diff.js';
import { exportCommand } from './export.js';
import { infoCommand } from './info.js';
import { initCommand } from './init.js';
import { listCommand } from './list.js';
import { runCommand } from './run.js';
import { runsCommand } from './runs.js';
import { syncCommand } from './sync.js';
import { validateCommand } from './validate.js';

export const testCommand = new Command('test').description('Manage and run test definitions');

// Register subcommands
testCommand.addCommand(runCommand);
testCommand.addCommand(listCommand);
testCommand.addCommand(infoCommand);
testCommand.addCommand(runsCommand);
testCommand.addCommand(validateCommand);
testCommand.addCommand(initCommand);
testCommand.addCommand(exportCommand);
testCommand.addCommand(syncCommand);
testCommand.addCommand(diffCommand);
