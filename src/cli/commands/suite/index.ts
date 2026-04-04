/**
 * qa-use suite - Manage test suites
 */

import { Command } from 'commander';
import { createCommand } from './create.js';
import { deleteCommand } from './delete.js';
import { infoCommand } from './info.js';
import { listCommand } from './list.js';
import { runCommand } from './run.js';
import { updateCommand } from './update.js';

export const suiteCommand = new Command('suite').description('Manage test suites');

suiteCommand.addCommand(listCommand);
suiteCommand.addCommand(infoCommand);
suiteCommand.addCommand(createCommand);
suiteCommand.addCommand(updateCommand);
suiteCommand.addCommand(deleteCommand);
suiteCommand.addCommand(runCommand);
