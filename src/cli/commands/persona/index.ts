/**
 * qa-use persona - Manage personas
 */

import { Command } from 'commander';
import { createCommand } from './create.js';
import { deleteCommand } from './delete.js';
import { infoCommand } from './info.js';
import { listCommand } from './list.js';
import { updateCommand } from './update.js';

export const personaCommand = new Command('persona').description('Manage personas');

personaCommand.addCommand(listCommand);
personaCommand.addCommand(infoCommand);
personaCommand.addCommand(createCommand);
personaCommand.addCommand(updateCommand);
personaCommand.addCommand(deleteCommand);
