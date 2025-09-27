import { Command } from 'commander';
import { ConfigService } from '../services/ConfigService.js';

export function createConfigCommand() {
  const config = new Command('config');

  config
    .description('Manage configuration settings')
    .option('--show', 'Show current configuration')
    .option('--set-url <url>', 'Set default URL')
    .option('--set-app-url <url>', 'Set app URL')
    .option('--enable-forwarder-logging', 'Enable detailed forwarder logging')
    .option('--disable-forwarder-logging', 'Disable forwarder logging')
    .option('--reset', 'Reset configuration to defaults')
    .action(async (options) => {
      const chalk = (await import('chalk')).default;
      const { confirm } = await import('@inquirer/prompts');
      const configService = new ConfigService();

      if (options.show) {
        const config = configService.getAll();
        console.log(chalk.cyan('⚙️ Current Configuration:'));
        console.log(
          chalk.gray(`  API Key: ${config.apiKey ? '***' + config.apiKey.slice(-4) : 'Not set'}`)
        );
        console.log(chalk.gray(`  Default URL: ${config.defaultUrl || 'Not set'}`));
        console.log(chalk.gray(`  App URL: ${configService.getAppUrl()}`));
        console.log(
          chalk.gray(
            `  Forwarder Logging: ${configService.isForwarderLoggingEnabled() ? 'Enabled' : 'Disabled'}`
          )
        );
        return;
      }

      if (options.setUrl) {
        configService.setDefaultUrl(options.setUrl);
        console.log(chalk.green(`✅ Default URL set to: ${options.setUrl}`));
      }

      if (options.setAppUrl) {
        configService.setAppUrl(options.setAppUrl);
        console.log(chalk.green(`✅ App URL set to: ${options.setAppUrl}`));
      }

      if (options.enableForwarderLogging) {
        configService.setForwarderLogging(true);
        console.log(chalk.green('✅ Forwarder logging enabled'));
      }

      if (options.disableForwarderLogging) {
        configService.setForwarderLogging(false);
        console.log(chalk.green('✅ Forwarder logging disabled'));
      }

      if (options.reset) {
        const confirmReset = await confirm({
          message: 'Are you sure you want to reset all configuration?',
          default: false,
        });

        if (confirmReset) {
          configService.reset();
          console.log(chalk.green('✅ Configuration reset to defaults'));
        } else {
          console.log(chalk.gray('Reset cancelled'));
        }
      }

      // If no options provided, show help
      if (
        !options.show &&
        !options.setUrl &&
        !options.setAppUrl &&
        !options.enableForwarderLogging &&
        !options.disableForwarderLogging &&
        !options.reset
      ) {
        console.log(chalk.cyan('⚙️ Configuration Management'));
        console.log(chalk.gray('\nAvailable options:'));
        console.log(
          chalk.blue('  --show                       ') + chalk.gray('Show current configuration')
        );
        console.log(chalk.blue('  --set-url <url>              ') + chalk.gray('Set default URL'));
        console.log(chalk.blue('  --set-app-url <url>          ') + chalk.gray('Set app URL'));
        console.log(
          chalk.blue('  --enable-forwarder-logging   ') +
            chalk.gray('Enable detailed forwarder logging')
        );
        console.log(
          chalk.blue('  --disable-forwarder-logging  ') + chalk.gray('Disable forwarder logging')
        );
        console.log(
          chalk.blue('  --reset                      ') +
            chalk.gray('Reset configuration to defaults')
        );
      }
    });

  return config;
}
