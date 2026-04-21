/**
 * qa-use tunnel - Manage background tunnels
 */

import { Command } from 'commander';
import { closeCommand } from './close.js';
import { lsCommand } from './ls.js';
import { startCommand } from './start.js';
import { statusCommand } from './status.js';

export function tunnelCommand(): Command {
  const cmd = new Command('tunnel').description(
    'Inspect and manage the qa-use tunnel registry (localhost → public URL)'
  );

  cmd.addCommand(startCommand);
  cmd.addCommand(lsCommand);
  cmd.addCommand(statusCommand);
  cmd.addCommand(closeCommand);

  return cmd;
}
