#!/usr/bin/env node

import { Command } from 'commander';
import { packageJson } from './package.js';
import { createAuthCommand } from './commands/auth.js';
import { createLogoutCommand } from './commands/logout.js';
import { createConfigCommand } from './commands/config.js';
import { createForwardCommand } from './commands/forward.js';
import { createWatchCommand } from './commands/watch.js';
import { createRunCommand } from './commands/run.js';
import { startInteractiveMode } from './ui/InteractiveMode.js';

const program = new Command();

program
  .name(packageJson.name)
  .description(packageJson.description || 'CLI tool to connect local development to desplega.ai')
  .version(packageJson.version)
  .option('-i, --interactive', 'Run in interactive mode')
  .action(async (options) => {
    if (options.interactive) {
      // Show interactive UI when requested
      await startInteractiveMode();
    } else {
      // Show simple help by default
      // Use chalk for colors in non-interactive mode
      const chalk = (await import('chalk')).default;
      console.log(`
${chalk.cyan(' ██████╗  █████╗       ██╗   ██╗███████╗███████╗')}
${chalk.cyan('██╔═══██╗██╔══██╗      ██║   ██║██╔════╝██╔════╝')}
${chalk.cyan('██║   ██║███████║█████╗██║   ██║███████╗█████╗')}
${chalk.cyan('██║▄▄ ██║██╔══██║╚════╝██║   ██║╚════██║██╔══╝')}
${chalk.cyan('╚██████╔╝██║  ██║      ╚██████╔╝███████║███████╗')}
${chalk.cyan(' ╚══▀▀═╝ ╚═╝  ╚═╝       ╚═════╝ ╚══════╝╚══════╝')}

${chalk.green('Welcome to QA-USE CLI Tool')}

${chalk.yellow('Available Commands:')}
  ${chalk.blue('auth')}      Authenticate with the service
  ${chalk.blue('logout')}    Logout from the service
  ${chalk.blue('config')}    Manage configuration settings
  ${chalk.blue('forward')}   Start browser forwarding to public endpoint
  ${chalk.blue('watch')}     Watch for file changes
  ${chalk.blue('run')}       Start QA session with browser forwarding

${chalk.gray('Use --help for more information or --interactive for interactive mode.')}
      `);
    }
  });

// Add commands
program.addCommand(createAuthCommand());
program.addCommand(createLogoutCommand());
program.addCommand(createConfigCommand());
program.addCommand(createForwardCommand());
program.addCommand(createWatchCommand());
program.addCommand(createRunCommand());

program.parse();
