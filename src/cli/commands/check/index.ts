/**
 * qa-use check - Manage remote API checks
 */

import { Command } from 'commander';
import { createCommand } from './create.js';
import { deleteCommand } from './delete.js';
import { infoCommand } from './info.js';
import { listCommand } from './list.js';
import { updateCommand } from './update.js';

export const checkCommand = new Command('check').description('Manage remote API checks');

checkCommand.addCommand(listCommand);
checkCommand.addCommand(infoCommand);
checkCommand.addCommand(createCommand);
checkCommand.addCommand(updateCommand);
checkCommand.addCommand(deleteCommand);
