/**
 * qa-use app-context - Manage app contexts
 */

import { Command } from 'commander';
import { createCommand } from './create.js';
import { deleteCommand } from './delete.js';
import { infoCommand } from './info.js';
import { listCommand } from './list.js';
import { updateCommand } from './update.js';

export const appContextCommand = new Command('app-context').description('Manage app contexts');

appContextCommand.addCommand(listCommand);
appContextCommand.addCommand(infoCommand);
appContextCommand.addCommand(createCommand);
appContextCommand.addCommand(updateCommand);
appContextCommand.addCommand(deleteCommand);
