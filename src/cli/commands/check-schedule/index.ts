/**
 * qa-use check-schedule - Manage remote check schedules
 */

import { Command } from 'commander';
import { createCommand } from './create.js';
import { deleteCommand } from './delete.js';
import { infoCommand } from './info.js';
import { listCommand } from './list.js';
import { runCommand } from './run.js';
import { updateCommand } from './update.js';

export const checkScheduleCommand = new Command('check-schedule').description(
  'Manage remote check schedules'
);

checkScheduleCommand.addCommand(listCommand);
checkScheduleCommand.addCommand(infoCommand);
checkScheduleCommand.addCommand(createCommand);
checkScheduleCommand.addCommand(updateCommand);
checkScheduleCommand.addCommand(deleteCommand);
checkScheduleCommand.addCommand(runCommand);
