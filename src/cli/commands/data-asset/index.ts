/**
 * qa-use data-asset - Manage data assets
 */

import { Command } from 'commander';
import { deleteCommand } from './delete.js';
import { infoCommand } from './info.js';
import { listCommand } from './list.js';
import { uploadCommand } from './upload.js';

export const dataAssetCommand = new Command('data-asset').description('Manage data assets');

dataAssetCommand.addCommand(listCommand);
dataAssetCommand.addCommand(infoCommand);
dataAssetCommand.addCommand(uploadCommand);
dataAssetCommand.addCommand(deleteCommand);
