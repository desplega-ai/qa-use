/**
 * qa-use test - Test management command group
 */

import { Command } from 'commander';
import { runCommand } from './run.js';
import { listCommand } from './list.js';
import { validateCommand } from './validate.js';
import { initCommand } from './init.js';

export const testCommand = new Command('test').description('Manage and run test definitions');

// Register subcommands
testCommand.addCommand(runCommand);
testCommand.addCommand(listCommand);
testCommand.addCommand(validateCommand);
testCommand.addCommand(initCommand);
