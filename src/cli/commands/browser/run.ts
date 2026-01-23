/**
 * qa-use browser run - Interactive REPL mode
 */

import { Command } from 'commander';
import * as readline from 'readline';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import type { ViewportType, ScrollDirection } from '../../../../lib/api/browser-types.js';
import {
  resolveSessionId,
  storeSession,
  removeStoredSession,
  touchSession,
  createStoredSession,
} from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { success, error, info } from '../../lib/output.js';

interface RunOptions {
  sessionId?: string;
  headless?: boolean;
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

export const runCommand = new Command('run')
  .description('Start an interactive REPL session for browser control')
  .option('-s, --session-id <id>', 'Use existing session ID')
  .option('--headless', 'Run browser in headless mode (for new sessions)', true)
  .option('--no-headless', 'Run browser with visible UI (for new sessions)')
  .action(async (options: RunOptions) => {
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

      let sessionId: string;
      let sessionOwned = false;

      // Try to use existing session or create new one
      if (options.sessionId) {
        // Use explicitly provided session
        try {
          await client.getSession(options.sessionId);
          sessionId = options.sessionId;
          console.log(info(`Attached to session ${sessionId}`));
        } catch {
          console.log(error(`Session ${options.sessionId} not found`));
          process.exit(1);
        }
      } else {
        // Try to resolve from storage, otherwise create new
        try {
          const resolved = await resolveSessionId({
            explicitId: undefined,
            client,
            verify: true,
          });
          sessionId = resolved.id;
          console.log(info(`Using existing session ${sessionId}`));
        } catch {
          // No existing session, create new one
          console.log(info('Creating new browser session...'));

          const session = await client.createSession({
            headless: options.headless !== false,
            viewport: 'desktop',
            timeout: 300,
          });

          sessionId = session.id;
          sessionOwned = true;

          if (session.status === 'starting') {
            console.log(info('Waiting for session to become active...'));
            await client.waitForStatus(session.id, 'active', 60000);
          }

          // Store session locally
          const storedSession = createStoredSession(session.id);
          await storeSession(storedSession);

          console.log(success(`Session ${sessionId} ready.`));
        }
      }

      console.log('');
      console.log('Type "help" for available commands, "exit" to quit.');
      console.log('');

      // Create readline interface
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${colors.cyan}browser>${colors.reset} `,
      });

      // Command handlers
      const commands: Record<
        string,
        (args: string[], client: BrowserApiClient, sessionId: string) => Promise<void>
      > = {
        help: async () => printHelp(),
        goto: async (args, client, sessionId) => {
          if (args.length === 0) {
            console.log(error('Usage: goto <url>'));
            return;
          }
          let url = args[0];
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          const result = await client.executeAction(sessionId, { type: 'goto', url });
          if (result.success) {
            console.log(success(`Navigated to ${url}`));
          } else {
            console.log(error(result.error || 'Navigation failed'));
          }
        },
        click: async (args, client, sessionId) => {
          if (args.length === 0) {
            console.log(error('Usage: click <ref>'));
            return;
          }
          const ref = normalizeRef(args[0]);
          const result = await client.executeAction(sessionId, { type: 'click', ref });
          if (result.success) {
            console.log(success(`Clicked ${ref}`));
          } else {
            console.log(error(result.error || 'Click failed'));
          }
        },
        fill: async (args, client, sessionId) => {
          if (args.length < 2) {
            console.log(error('Usage: fill <ref> <value>'));
            return;
          }
          const ref = normalizeRef(args[0]);
          const value = args.slice(1).join(' ');
          const result = await client.executeAction(sessionId, { type: 'fill', ref, value });
          if (result.success) {
            console.log(success(`Filled ${ref}`));
          } else {
            console.log(error(result.error || 'Fill failed'));
          }
        },
        type: async (args, client, sessionId) => {
          if (args.length < 2) {
            console.log(error('Usage: type <ref> <text>'));
            return;
          }
          const ref = normalizeRef(args[0]);
          const text = args.slice(1).join(' ');
          const result = await client.executeAction(sessionId, { type: 'type', ref, text });
          if (result.success) {
            console.log(success(`Typed into ${ref}`));
          } else {
            console.log(error(result.error || 'Type failed'));
          }
        },
        press: async (args, client, sessionId) => {
          if (args.length === 0) {
            console.log(error('Usage: press <key>'));
            return;
          }
          const key = args[0];
          const result = await client.executeAction(sessionId, { type: 'press', key });
          if (result.success) {
            console.log(success(`Pressed ${key}`));
          } else {
            console.log(error(result.error || 'Press failed'));
          }
        },
        hover: async (args, client, sessionId) => {
          if (args.length === 0) {
            console.log(error('Usage: hover <ref>'));
            return;
          }
          const ref = normalizeRef(args[0]);
          const result = await client.executeAction(sessionId, { type: 'hover', ref });
          if (result.success) {
            console.log(success(`Hovering ${ref}`));
          } else {
            console.log(error(result.error || 'Hover failed'));
          }
        },
        scroll: async (args, client, sessionId) => {
          if (args.length === 0) {
            console.log(error('Usage: scroll <direction> [amount]'));
            return;
          }
          const direction = args[0].toLowerCase() as ScrollDirection;
          const amount = args[1] ? parseInt(args[1], 10) : 500;
          const result = await client.executeAction(sessionId, { type: 'scroll', direction, amount });
          if (result.success) {
            console.log(success(`Scrolled ${direction} ${amount}px`));
          } else {
            console.log(error(result.error || 'Scroll failed'));
          }
        },
        select: async (args, client, sessionId) => {
          if (args.length < 2) {
            console.log(error('Usage: select <ref> <value>'));
            return;
          }
          const ref = normalizeRef(args[0]);
          const value = args.slice(1).join(' ');
          const result = await client.executeAction(sessionId, { type: 'select', ref, value });
          if (result.success) {
            console.log(success(`Selected "${value}" in ${ref}`));
          } else {
            console.log(error(result.error || 'Select failed'));
          }
        },
        wait: async (args, client, sessionId) => {
          if (args.length === 0) {
            console.log(error('Usage: wait <ms>'));
            return;
          }
          const duration_ms = parseInt(args[0], 10);
          const result = await client.executeAction(sessionId, { type: 'wait', duration_ms });
          if (result.success) {
            console.log(success(`Waited ${duration_ms}ms`));
          } else {
            console.log(error(result.error || 'Wait failed'));
          }
        },
        snapshot: async (args, client, sessionId) => {
          const snapshot = await client.getSnapshot(sessionId);
          if (snapshot.url) {
            console.log(`URL: ${snapshot.url}\n`);
          }
          console.log(snapshot.aria_tree);
        },
        screenshot: async (args, client, sessionId) => {
          const buffer = await client.getScreenshot(sessionId);
          const filename = args[0] || `screenshot-${Date.now()}.png`;
          const fs = await import('fs');
          fs.writeFileSync(filename, buffer);
          console.log(success(`Screenshot saved to ${filename}`));
        },
        url: async (args, client, sessionId) => {
          const url = await client.getUrl(sessionId);
          console.log(url);
        },
        status: async (args, client, sessionId) => {
          const session = await client.getSession(sessionId);
          console.log(`ID: ${session.id}`);
          console.log(`Status: ${session.status}`);
          console.log(`URL: ${session.url || 'none'}`);
        },
      };

      // Handle input
      rl.prompt();
      rl.on('line', async (line) => {
        const trimmed = line.trim();

        if (!trimmed) {
          rl.prompt();
          return;
        }

        // Parse command and args
        const parts = parseCommandLine(trimmed);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Handle exit
        if (cmd === 'exit' || cmd === 'quit') {
          await handleExit(rl, client, sessionId, sessionOwned);
          return;
        }

        // Handle command
        const handler = commands[cmd];
        if (!handler) {
          console.log(error(`Unknown command: ${cmd}. Type "help" for available commands.`));
          rl.prompt();
          return;
        }

        try {
          await handler(args, client, sessionId);
          await touchSession(sessionId);
        } catch (err) {
          console.log(error(err instanceof Error ? err.message : 'Command failed'));
        }

        rl.prompt();
      });

      // Handle Ctrl+C
      rl.on('SIGINT', async () => {
        console.log('');
        await handleExit(rl, client, sessionId, sessionOwned);
      });

      rl.on('close', () => {
        process.exit(0);
      });
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to start REPL'));
      process.exit(1);
    }
  });

/**
 * Normalize ref by stripping leading @ if present
 */
function normalizeRef(ref: string): string {
  return ref.startsWith('@') ? ref.slice(1) : ref;
}

/**
 * Parse command line, respecting quotes
 */
function parseCommandLine(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (const char of line) {
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Print help message
 */
function printHelp(): Promise<void> {
  console.log(`
Available commands:

  ${colors.cyan}Navigation & Actions:${colors.reset}
    goto <url>              Navigate to URL
    click <ref>             Click element
    fill <ref> <value>      Fill input field
    type <ref> <text>       Type text with delays
    press <key>             Press keyboard key
    hover <ref>             Hover over element
    scroll <dir> [amount]   Scroll page (up/down/left/right)
    select <ref> <value>    Select dropdown option
    wait <ms>               Wait for duration

  ${colors.cyan}Inspection:${colors.reset}
    snapshot                Get ARIA accessibility tree
    screenshot [file]       Save screenshot
    url                     Get current URL
    status                  Get session status

  ${colors.cyan}Session:${colors.reset}
    exit, quit              Exit REPL (prompts to close session)
    help                    Show this help

  ${colors.gray}Refs like "e3" or "@e3" identify elements in the snapshot.${colors.reset}
`);
  return Promise.resolve();
}

/**
 * Handle exit command
 */
async function handleExit(
  rl: readline.Interface,
  client: BrowserApiClient,
  sessionId: string,
  sessionOwned: boolean
): Promise<void> {
  if (sessionOwned) {
    // Prompt user to close session
    const askClose = () => {
      return new Promise<boolean>((resolve) => {
        rl.question('Close session? (y/n): ', (answer) => {
          const lower = answer.toLowerCase().trim();
          if (lower === 'y' || lower === 'yes') {
            resolve(true);
          } else if (lower === 'n' || lower === 'no') {
            resolve(false);
          } else {
            askClose().then(resolve);
          }
        });
      });
    };

    const shouldClose = await askClose();

    if (shouldClose) {
      try {
        await client.deleteSession(sessionId);
        await removeStoredSession(sessionId);
        console.log(success('Session closed.'));
      } catch (err) {
        console.log(error('Failed to close session'));
      }
    } else {
      console.log(info(`Session ${sessionId} kept alive.`));
    }
  }

  rl.close();
}
