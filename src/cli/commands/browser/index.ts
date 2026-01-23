/**
 * qa-use browser - Browser control command group
 *
 * Control remote browsers via the desplega.ai Browser API.
 * Uses accessibility-based element targeting with refs.
 */

import { Command } from 'commander';

// Session management commands
import { createCommand } from './create.js';
import { listCommand } from './list.js';
import { statusCommand } from './status.js';
import { closeCommand } from './close.js';

// Navigation & action commands
import { gotoCommand } from './goto.js';
import { clickCommand } from './click.js';
import { fillCommand } from './fill.js';
import { typeCommand } from './type.js';
import { pressCommand } from './press.js';
import { hoverCommand } from './hover.js';
import { scrollCommand } from './scroll.js';
import { selectCommand } from './select.js';
import { waitCommand } from './wait.js';

// Inspection commands
import { snapshotCommand } from './snapshot.js';
import { screenshotCommand } from './screenshot.js';
import { urlCommand } from './url.js';

// Advanced commands
import { streamCommand } from './stream.js';
import { runCommand } from './run.js';

export const browserCommand = new Command('browser').description('Control remote browsers');

// Register session management commands
browserCommand.addCommand(createCommand);
browserCommand.addCommand(listCommand);
browserCommand.addCommand(statusCommand);
browserCommand.addCommand(closeCommand);

// Register navigation & action commands
browserCommand.addCommand(gotoCommand);
browserCommand.addCommand(clickCommand);
browserCommand.addCommand(fillCommand);
browserCommand.addCommand(typeCommand);
browserCommand.addCommand(pressCommand);
browserCommand.addCommand(hoverCommand);
browserCommand.addCommand(scrollCommand);
browserCommand.addCommand(selectCommand);
browserCommand.addCommand(waitCommand);

// Register inspection commands
browserCommand.addCommand(snapshotCommand);
browserCommand.addCommand(screenshotCommand);
browserCommand.addCommand(urlCommand);

// Register advanced commands
browserCommand.addCommand(streamCommand);
browserCommand.addCommand(runCommand);
