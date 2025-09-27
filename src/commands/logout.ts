import { Command } from 'commander';

export function createLogoutCommand() {
  const logout = new Command('logout');

  logout.description('Logout from the QA service').action(async () => {
    const chalk = (await import('chalk')).default;
    console.log(chalk.yellow('👋 Logout coming soon...'));
    // TODO: Implement logout logic
  });

  return logout;
}
