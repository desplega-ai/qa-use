import { Command } from 'commander';
import { BrowserForwarder } from '../services/BrowserForwarder.js';

export function createForwardCommand() {
  const forward = new Command('forward');

  forward
    .description('Start forwarding local browser to public endpoint')
    .option('-p, --port <port>', 'Local port to forward (default: auto-detect from browser)', '')
    .option('--headless', 'Run browser in headless mode', false)
    .option('--stop', 'Stop active forwarding session', false)
    .option('--status', 'Show current forwarding status', false)
    .option('--examples', 'Show connection examples for active session', false)
    .action(async (options) => {
      const chalk = (await import('chalk')).default;
      const forwarder = new BrowserForwarder();

      try {
        if (options.stop) {
          await forwarder.stop();
          return;
        }

        if (options.status) {
          const status = forwarder.getStatus();
          if (status) {
            console.log(chalk.green('✅ Forwarding is active'));
            console.log(chalk.gray(`Local WebSocket: ${status.wsEndpoint}`));
            console.log(chalk.gray(`Public URL: ${status.publicUrl}`));
            console.log(
              chalk.cyan(
                `WebSocket endpoint: ${status.publicUrl.replace('https://', 'wss://').replace('http://', 'ws://')}`
              )
            );
            console.log(chalk.gray(`\nUse bypass header: bypass-tunnel-reminder: true`));
          } else {
            console.log(chalk.yellow('No active forwarding session'));
          }
          return;
        }

        if (options.examples) {
          const examples = forwarder.getConnectionExamples();
          if (examples) {
            console.log(examples);
          } else {
            console.log(
              chalk.yellow('No active forwarding session. Start one with: qa-use forward')
            );
          }
          return;
        }

        // Start forwarding
        await forwarder.start();
        await forwarder.waitForConnection();
      } catch (error) {
        console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return forward;
}
