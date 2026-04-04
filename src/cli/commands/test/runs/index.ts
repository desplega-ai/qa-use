/**
 * qa-use test runs - View and manage test run history
 */

import { Command } from 'commander';
import { cancelCommand } from './cancel.js';
import { infoCommand } from './info.js';
import { listCommand } from './list.js';
import { logsCommand } from './logs.js';
import { stepsCommand } from './steps.js';

export const runsCommand = new Command('runs').description('View and manage test run history');

runsCommand.addCommand(listCommand);
runsCommand.addCommand(infoCommand);
runsCommand.addCommand(logsCommand);
runsCommand.addCommand(stepsCommand);
runsCommand.addCommand(cancelCommand);
