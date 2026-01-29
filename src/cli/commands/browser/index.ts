/**
 * qa-use browser - Browser control command group
 *
 * Control remote browsers via the desplega.ai Browser API.
 * Uses accessibility-based element targeting with refs.
 */

import { Command } from 'commander';
import { backCommand } from './back.js';
import { checkCommand } from './check.js';
import { clickCommand } from './click.js';
import { closeCommand } from './close.js';
// Session management commands
import { createCommand } from './create.js';
import { dragCommand } from './drag.js';
import { fillCommand } from './fill.js';
import { forwardCommand } from './forward.js';
import { generateTestCommand } from './generate-test.js';
import { getBlocksCommand } from './get-blocks.js';
// Navigation & action commands
import { gotoCommand } from './goto.js';
import { hoverCommand } from './hover.js';
import { listCommand } from './list.js';
import { logsCommand } from './logs.js';
import { mfaTotpCommand } from './mfa-totp.js';
import { pressCommand } from './press.js';
import { reloadCommand } from './reload.js';
import { runCommand } from './run.js';
import { screenshotCommand } from './screenshot.js';
import { scrollCommand } from './scroll.js';
import { scrollIntoViewCommand } from './scroll-into-view.js';
import { selectCommand } from './select.js';
// Inspection commands
import { snapshotCommand } from './snapshot.js';
import { statusCommand } from './status.js';
// Advanced commands
import { streamCommand } from './stream.js';
import { typeCommand } from './type.js';
import { uncheckCommand } from './uncheck.js';
import { uploadCommand } from './upload.js';
import { urlCommand } from './url.js';
import { waitCommand } from './wait.js';
import { waitForLoadCommand } from './wait-for-load.js';
import { waitForSelectorCommand } from './wait-for-selector.js';

export const browserCommand = new Command('browser').description('Control remote browsers');

// Register session management commands
browserCommand.addCommand(createCommand);
browserCommand.addCommand(listCommand);
browserCommand.addCommand(statusCommand);
browserCommand.addCommand(closeCommand);

// Register navigation & action commands
browserCommand.addCommand(gotoCommand);
browserCommand.addCommand(backCommand);
browserCommand.addCommand(forwardCommand);
browserCommand.addCommand(reloadCommand);
browserCommand.addCommand(clickCommand);
browserCommand.addCommand(fillCommand);
browserCommand.addCommand(typeCommand);
browserCommand.addCommand(pressCommand);
browserCommand.addCommand(hoverCommand);
browserCommand.addCommand(scrollCommand);
browserCommand.addCommand(scrollIntoViewCommand);
browserCommand.addCommand(selectCommand);
browserCommand.addCommand(checkCommand);
browserCommand.addCommand(uncheckCommand);
browserCommand.addCommand(dragCommand);
browserCommand.addCommand(mfaTotpCommand);
browserCommand.addCommand(uploadCommand);
browserCommand.addCommand(waitCommand);
browserCommand.addCommand(waitForSelectorCommand);
browserCommand.addCommand(waitForLoadCommand);

// Register inspection commands
browserCommand.addCommand(snapshotCommand);
browserCommand.addCommand(screenshotCommand);
browserCommand.addCommand(urlCommand);
browserCommand.addCommand(getBlocksCommand);
browserCommand.addCommand(logsCommand);
browserCommand.addCommand(generateTestCommand);

// Register advanced commands
browserCommand.addCommand(streamCommand);
browserCommand.addCommand(runCommand);
