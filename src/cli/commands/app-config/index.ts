/**
 * qa-use app-config - Manage app configurations
 */

import { Command } from 'commander';
import { createCommand } from './create.js';
import { deleteCommand } from './delete.js';
import { infoCommand } from './info.js';
import { listCommand } from './list.js';
import { updateCommand } from './update.js';

export const appConfigCommand = new Command('app-config').description('Manage app configurations');

appConfigCommand.addCommand(listCommand);
appConfigCommand.addCommand(infoCommand);
appConfigCommand.addCommand(createCommand);
appConfigCommand.addCommand(updateCommand);
appConfigCommand.addCommand(deleteCommand);
