/**
 * qa-use issues - View test issues
 */

import { Command } from 'commander';
import { infoCommand } from './info.js';
import { listCommand } from './list.js';
import { occurrencesCommand } from './occurrences.js';

export const issuesCommand = new Command('issues').description('View test issues');

issuesCommand.addCommand(listCommand);
issuesCommand.addCommand(infoCommand);
issuesCommand.addCommand(occurrencesCommand);
