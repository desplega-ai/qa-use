/**
 * qa-use browser create - Create a new browser session
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import type { ViewportType } from '../../../../lib/api/browser-types.js';
import { storeSession, createStoredSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error, info } from '../../lib/output.js';

interface CreateOptions {
  headless?: boolean;
  viewport?: ViewportType;
  timeout?: number;
}

export const createCommand = new Command('create')
  .description('Create a new browser session')
  .option('--headless', 'Run browser in headless mode (default: true)', true)
  .option('--no-headless', 'Run browser with visible UI')
  .option(
    '--viewport <type>',
    'Viewport type: desktop, mobile, or tablet (default: desktop)',
    'desktop'
  )
  .option('--timeout <seconds>', 'Session timeout in seconds (default: 300)', '300')
  .action(async (options: CreateOptions) => {
    try {
      // Load configuration
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      // Create client and set API key
      const client = new BrowserApiClient(config.api_url);
      client.setApiKey(config.api_key);

      // Validate viewport type
      const validViewports: ViewportType[] = ['desktop', 'mobile', 'tablet'];
      const viewport = (options.viewport || 'desktop') as ViewportType;
      if (!validViewports.includes(viewport)) {
        console.log(
          error(`Invalid viewport: ${viewport}. Must be one of: ${validViewports.join(', ')}`)
        );
        process.exit(1);
      }

      // Parse timeout
      const timeout = parseInt(String(options.timeout), 10);
      if (isNaN(timeout) || timeout < 60 || timeout > 3600) {
        console.log(error('Timeout must be between 60 and 3600 seconds'));
        process.exit(1);
      }

      console.log(info('Creating browser session...'));

      // Create session
      const session = await client.createSession({
        headless: options.headless !== false,
        viewport,
        timeout,
      });

      console.log(info(`Session created: ${session.id}`));
      console.log(info(`Status: ${session.status}`));

      // Wait for session to become active if starting
      if (session.status === 'starting') {
        console.log(info('Waiting for session to become active...'));
        const activeSession = await client.waitForStatus(session.id, 'active', 60000);
        console.log(success(`Session ${activeSession.id} is now active`));
      } else if (session.status === 'active') {
        console.log(success(`Session ${session.id} is active`));
      }

      // Store session locally
      const storedSession = createStoredSession(session.id);
      await storeSession(storedSession);

      // Print session info
      console.log('');
      console.log(`Session ID: ${session.id}`);
      console.log(`Viewport: ${viewport}`);
      console.log(`Headless: ${options.headless !== false}`);
      console.log(`Timeout: ${timeout}s`);
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to create session'));
      process.exit(1);
    }
  });
