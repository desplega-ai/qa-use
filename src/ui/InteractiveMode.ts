import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { createTabCompleteInput } from './TabCompleteInput.js';

const ASCII_ART = `
 ██████╗  █████╗       ██╗   ██╗███████╗███████╗
██╔═══██╗██╔══██╗      ██║   ██║██╔════╝██╔════╝
██║   ██║███████║█████╗██║   ██║███████╗█████╗
██║▄▄ ██║██╔══██║╚════╝██║   ██║╚════██║██╔══╝
╚██████╔╝██║  ██║      ╚██████╔╝███████║███████╗
 ╚══▀▀═╝ ╚═╝  ╚═╝       ╚═════╝ ╚══════╝╚══════╝
`;

const COMMANDS = [
  { name: '/auth', description: 'Authenticate with the service' },
  { name: '/logout', description: 'Logout from the service' },
  { name: '/config', description: 'Manage configuration' },
  { name: '/forward', description: 'Start browser forwarding' },
  { name: '/watch', description: 'Watch for file changes' },
  { name: '/help', description: 'Show this help' },
  { name: '/clear', description: 'Clear output' },
  { name: '/exit', description: 'Exit the application' },
];

function showWelcome() {
  console.log(chalk.cyan(ASCII_ART));
  console.log(chalk.green('Welcome to QA-USE CLI Tool'));
  console.log();
  console.log(chalk.yellow('Available Slash Commands:'));
  COMMANDS.forEach((cmd) => {
    console.log(
      `• ${chalk.blue(cmd.name)}${' '.repeat(10 - cmd.name.length)} - ${cmd.description}`
    );
  });
  console.log(chalk.gray('• Use Tab for autocomplete, Ctrl+C to exit'));
  console.log();
}

async function handleCommand(command: string): Promise<boolean> {
  const cmd = command.startsWith('/') ? command.slice(1) : command;

  switch (cmd) {
    case 'auth':
      console.log(chalk.blue('🔐 Starting authentication...'));
      console.log(chalk.gray('Use Ctrl+C to cancel if needed'));

      try {
        // Import and run auth command
        const { createAuthCommand } = await import('../commands/auth.js');
        const authCmd = createAuthCommand();

        // Simulate command execution
        await authCmd.parseAsync(['auth'], { from: 'user' });
      } catch (error) {
        if (error instanceof Error && error.message.includes('process.exit')) {
          // Handle expected exit from auth command
          console.log(chalk.gray('Auth command completed'));
        } else {
          console.log(
            chalk.red('Auth command failed:'),
            error instanceof Error ? error.message : error
          );
        }
      }
      break;
    case 'logout':
      console.log(chalk.yellow('👋 Logout coming soon...'));
      break;
    case 'config':
      console.log(chalk.cyan('⚙️ Configuration management coming soon...'));
      break;
    case 'forward':
      console.log(chalk.green('🚀 Starting browser forwarding...'));
      console.log(chalk.gray('Note: Use the main command with options for full control:'));
      console.log(chalk.cyan('  qa-use forward --help'));
      break;
    case 'watch':
      console.log(chalk.blue('👀 Starting file watcher...'));
      console.log(chalk.gray('Note: Use the main command with options for full control:'));
      console.log(chalk.cyan('  qa-use watch --help'));
      break;
    case 'help':
      COMMANDS.forEach((cmd) => {
        console.log(`${chalk.blue(cmd.name)} - ${cmd.description}`);
      });
      break;
    case 'clear':
      console.clear();
      showWelcome();
      break;
    case 'exit':
      console.log(chalk.gray('Goodbye! 👋'));
      return false;
    default:
      if (command.startsWith('/')) {
        console.log(chalk.red(`Unknown command: ${cmd}. Type /help for available commands.`));
      } else {
        console.log(chalk.red(`Commands should start with / (e.g., /auth)`));
      }
  }

  return true;
}

export async function startInteractiveMode() {
  showWelcome();

  let running = true;

  while (running) {
    try {
      const command = await select({
        message: 'Select a command:',
        choices: [
          { name: 'Type custom command', value: 'custom' },
          { name: '--- Available Commands ---', value: 'separator', disabled: true },
          ...COMMANDS.map((cmd) => ({
            name: `${cmd.name} - ${cmd.description}`,
            value: cmd.name,
          })),
        ],
        pageSize: 15,
      });

      if (command === 'custom') {
        console.log(chalk.gray('Type a command (use Tab for completion):'));
        const customCommand = await createTabCompleteInput();

        if (customCommand && customCommand.trim()) {
          running = await handleCommand(customCommand.trim());
        }
      } else if (command && command.trim() && command !== 'separator') {
        running = await handleCommand(command.trim());
      }
    } catch {
      // Handle Ctrl+C
      console.log(chalk.gray('\nGoodbye! 👋'));
      break;
    }
  }
}
