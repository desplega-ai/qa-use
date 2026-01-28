/**
 * qa-use test - Test management command group
 */

import { Command } from 'commander';
import { runCommand } from './run.js';
import { listCommand } from './list.js';
import { validateCommand } from './validate.js';
import { initCommand } from './init.js';
import { exportCommand } from './export.js';
import { syncCommand } from './sync.js';
import { runsCommand } from './runs.js';

export const testCommand = new Command('test').description('Manage and run test definitions');

// Register subcommands
testCommand.addCommand(runCommand);
testCommand.addCommand(listCommand);
testCommand.addCommand(runsCommand);
testCommand.addCommand(validateCommand);
testCommand.addCommand(initCommand);
testCommand.addCommand(exportCommand);
testCommand.addCommand(syncCommand);
