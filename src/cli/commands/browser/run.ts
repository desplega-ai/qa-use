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
        back: async (args, client, sessionId) => {
          const result = await client.executeAction(sessionId, { type: 'back' });
          if (result.success) {
            console.log(success('Navigated back'));
          } else {
            console.log(error(result.error || 'Back failed'));
          }
        },
        forward: async (args, client, sessionId) => {
          const result = await client.executeAction(sessionId, { type: 'forward' });
          if (result.success) {
            console.log(success('Navigated forward'));
          } else {
            console.log(error(result.error || 'Forward failed'));
          }
        },
        reload: async (args, client, sessionId) => {
          const result = await client.executeAction(sessionId, { type: 'reload' });
          if (result.success) {
            console.log(success('Page reloaded'));
          } else {
            console.log(error(result.error || 'Reload failed'));
          }
        },
        click: async (args, client, sessionId) => {
          const parsed = parseTextOption(args);
          if (!parsed.ref && !parsed.text) {
            console.log(error('Usage: click <ref> or click -t "description"'));
            return;
          }
          const action: { type: 'click'; ref?: string; text?: string } = { type: 'click' };
          if (parsed.ref) action.ref = normalizeRef(parsed.ref);
          if (parsed.text) action.text = parsed.text;
          const result = await client.executeAction(sessionId, action);
          if (result.success) {
            const target = parsed.ref ? normalizeRef(parsed.ref) : `"${parsed.text}"`;
            console.log(success(`Clicked ${target}`));
          } else {
            console.log(error(result.error || 'Click failed'));
          }
        },
        fill: async (args, client, sessionId) => {
          const parsed = parseTextOption(args);
          if ((!parsed.ref && !parsed.text) || parsed.remaining.length === 0) {
            console.log(error('Usage: fill <ref> <value> or fill -t "description" <value>'));
            return;
          }
          const value = parsed.remaining.join(' ');
          const action: { type: 'fill'; ref?: string; text?: string; value: string } = {
            type: 'fill',
            value,
          };
          if (parsed.ref) action.ref = normalizeRef(parsed.ref);
          if (parsed.text) action.text = parsed.text;
          const result = await client.executeAction(sessionId, action);
          if (result.success) {
            const target = parsed.ref ? normalizeRef(parsed.ref) : `"${parsed.text}"`;
            console.log(success(`Filled ${target}`));
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
          const parsed = parseTextOption(args);
          if (!parsed.ref && !parsed.text) {
            console.log(error('Usage: hover <ref> or hover -t "description"'));
            return;
          }
          const action: { type: 'hover'; ref?: string; text?: string } = { type: 'hover' };
          if (parsed.ref) action.ref = normalizeRef(parsed.ref);
          if (parsed.text) action.text = parsed.text;
          const result = await client.executeAction(sessionId, action);
          if (result.success) {
            const target = parsed.ref ? normalizeRef(parsed.ref) : `"${parsed.text}"`;
            console.log(success(`Hovering ${target}`));
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
          const result = await client.executeAction(sessionId, {
            type: 'scroll',
            direction,
            amount,
          });
          if (result.success) {
            console.log(success(`Scrolled ${direction} ${amount}px`));
          } else {
            console.log(error(result.error || 'Scroll failed'));
          }
        },
        'scroll-into-view': async (args, client, sessionId) => {
          const parsed = parseTextOption(args);
          if (!parsed.ref && !parsed.text) {
            console.log(
              error('Usage: scroll-into-view <ref> or scroll-into-view -t "description"')
            );
            return;
          }
          const action: { type: 'scroll_into_view'; ref?: string; text?: string } = {
            type: 'scroll_into_view',
          };
          if (parsed.ref) action.ref = normalizeRef(parsed.ref);
          if (parsed.text) action.text = parsed.text;
          const result = await client.executeAction(sessionId, action);
          if (result.success) {
            const target = parsed.ref ? normalizeRef(parsed.ref) : `"${parsed.text}"`;
            console.log(success(`Scrolled ${target} into view`));
          } else {
            console.log(error(result.error || 'Scroll into view failed'));
          }
        },
        select: async (args, client, sessionId) => {
          const parsed = parseTextOption(args);
          if ((!parsed.ref && !parsed.text) || parsed.remaining.length === 0) {
            console.log(error('Usage: select <ref> <value> or select -t "description" <value>'));
            return;
          }
          const value = parsed.remaining.join(' ');
          const action: { type: 'select'; ref?: string; text?: string; value: string } = {
            type: 'select',
            value,
          };
          if (parsed.ref) action.ref = normalizeRef(parsed.ref);
          if (parsed.text) action.text = parsed.text;
          const result = await client.executeAction(sessionId, action);
          if (result.success) {
            const target = parsed.ref ? normalizeRef(parsed.ref) : `"${parsed.text}"`;
            console.log(success(`Selected "${value}" in ${target}`));
          } else {
            console.log(error(result.error || 'Select failed'));
          }
        },
        check: async (args, client, sessionId) => {
          const parsed = parseTextOption(args);
          if (!parsed.ref && !parsed.text) {
            console.log(error('Usage: check <ref> or check -t "description"'));
            return;
          }
          const action: { type: 'check'; ref?: string; text?: string } = { type: 'check' };
          if (parsed.ref) action.ref = normalizeRef(parsed.ref);
          if (parsed.text) action.text = parsed.text;
          const result = await client.executeAction(sessionId, action);
          if (result.success) {
            const target = parsed.ref ? normalizeRef(parsed.ref) : `"${parsed.text}"`;
            console.log(success(`Checked ${target}`));
          } else {
            console.log(error(result.error || 'Check failed'));
          }
        },
        uncheck: async (args, client, sessionId) => {
          const parsed = parseTextOption(args);
          if (!parsed.ref && !parsed.text) {
            console.log(error('Usage: uncheck <ref> or uncheck -t "description"'));
            return;
          }
          const action: { type: 'uncheck'; ref?: string; text?: string } = { type: 'uncheck' };
          if (parsed.ref) action.ref = normalizeRef(parsed.ref);
          if (parsed.text) action.text = parsed.text;
          const result = await client.executeAction(sessionId, action);
          if (result.success) {
            const target = parsed.ref ? normalizeRef(parsed.ref) : `"${parsed.text}"`;
            console.log(success(`Unchecked ${target}`));
          } else {
            console.log(error(result.error || 'Uncheck failed'));
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
        'wait-for-selector': async (args, client, sessionId) => {
          if (args.length === 0) {
            console.log(
              error(
                'Usage: wait-for-selector <selector> [--state visible|hidden|attached|detached]'
              )
            );
            return;
          }
          const selector = args[0];
          let state: 'visible' | 'hidden' | 'attached' | 'detached' = 'visible';
          const stateIdx = args.indexOf('--state');
          if (stateIdx !== -1 && args[stateIdx + 1]) {
            state = args[stateIdx + 1] as typeof state;
          }
          const result = await client.executeAction(sessionId, {
            type: 'wait_for_selector',
            selector,
            state,
          });
          if (result.success) {
            console.log(success(`Selector "${selector}" is ${state}`));
          } else {
            console.log(error(result.error || 'Wait for selector failed'));
          }
        },
        'wait-for-load': async (args, client, sessionId) => {
          let state: 'load' | 'domcontentloaded' | 'networkidle' = 'load';
          const stateIdx = args.indexOf('--state');
          if (stateIdx !== -1 && args[stateIdx + 1]) {
            state = args[stateIdx + 1] as typeof state;
          } else if (args.length > 0 && !args[0].startsWith('--')) {
            state = args[0] as typeof state;
          }
          const result = await client.executeAction(sessionId, {
            type: 'wait_for_load',
            state,
          });
          if (result.success) {
            console.log(success(`Page reached ${state} state`));
          } else {
            console.log(error(result.error || 'Wait for load failed'));
          }
        },
        snapshot: async (args, client, sessionId) => {
          // Parse flags from args
          const interactive = args.includes('--interactive') || args.includes('-i');
          const compact = args.includes('--compact') || args.includes('-c');
          const depthIdx = args.findIndex((a) => a === '--max-depth' || a === '-d');
          const max_depth = depthIdx !== -1 ? parseInt(args[depthIdx + 1], 10) : undefined;
          const scopeIdx = args.findIndex((a) => a === '--scope');
          const scope = scopeIdx !== -1 ? args[scopeIdx + 1] : undefined;

          const snapshot = await client.getSnapshot(sessionId, {
            interactive,
            compact,
            max_depth,
            scope,
          });

          if (snapshot.url) {
            console.log(`URL: ${snapshot.url}\n`);
          }
          if (snapshot.filter_stats) {
            console.log(
              `Filtered: ${snapshot.filter_stats.filtered_lines}/${snapshot.filter_stats.original_lines} lines (${snapshot.filter_stats.reduction_percent}% reduction)\n`
            );
          }
          console.log(snapshot.snapshot);
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
        'get-blocks': async (args, client, sessionId) => {
          const blocks = await client.getBlocks(sessionId);
          console.log(JSON.stringify(blocks, null, 2));
        },
        status: async (args, client, sessionId) => {
          const session = await client.getSession(sessionId);
          console.log(`ID: ${session.id}`);
          console.log(`Status: ${session.status}`);
          console.log(`URL: ${session.current_url || 'none'}`);
          if (session.app_url) {
            console.log(`App URL: ${session.app_url}`);
          }
          if (session.last_action_at) {
            console.log(`Last Action: ${session.last_action_at}`);
          }
          if (session.error_message) {
            console.log(`Error: ${session.error_message}`);
          }
        },
        'logs-console': async (args, client, sessionId) => {
          const levelIdx = args.indexOf('--level');
          const limitIdx = args.indexOf('--limit');
          const level = levelIdx !== -1 ? args[levelIdx + 1] : undefined;
          const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

          const result = await client.getConsoleLogs(sessionId, {
            level: level as 'log' | 'warn' | 'error' | 'info' | 'debug' | undefined,
            limit,
          });

          console.log(`Console logs (${result.total} total):\n`);
          for (const log of result.logs) {
            const prefix = log.level.toUpperCase().padEnd(5);
            console.log(`[${prefix}] ${log.text}`);
            if (log.url) console.log(`        at ${log.url}`);
          }
        },
        'logs-network': async (args, client, sessionId) => {
          const statusIdx = args.indexOf('--status');
          const patternIdx = args.indexOf('--url-pattern');
          const limitIdx = args.indexOf('--limit');
          const status = statusIdx !== -1 ? args[statusIdx + 1] : undefined;
          const url_pattern = patternIdx !== -1 ? args[patternIdx + 1] : undefined;
          const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

          const result = await client.getNetworkLogs(sessionId, { status, url_pattern, limit });

          console.log(`Network requests (${result.total} total):\n`);
          for (const req of result.requests) {
            const statusColor = req.status >= 400 ? '!' : ' ';
            console.log(
              `${statusColor}${req.method.padEnd(6)} ${req.status} ${req.url} (${req.duration_ms}ms)`
            );
          }
        },
        'generate-test': async (args, client, sessionId) => {
          const nameIdx = args.indexOf('--name');
          const configIdx = args.indexOf('--app-config');
          const outputIdx = args.indexOf('--output');

          if (nameIdx === -1 || !args[nameIdx + 1]) {
            console.log(
              error('Usage: generate-test --name <name> [--app-config <id>] [--output <file>]')
            );
            return;
          }

          const name = args[nameIdx + 1];
          const app_config = configIdx !== -1 ? args[configIdx + 1] : undefined;
          const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : undefined;

          const result = await client.generateTest(sessionId, { name, app_config });

          if (outputFile) {
            const fs = await import('fs');
            fs.writeFileSync(outputFile, result.yaml);
            console.log(success(`Test written to ${outputFile} (${result.block_count} blocks)`));
          } else {
            console.log(result.yaml);
          }
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
 * Parse -t/--text option from args
 * Returns { text, ref, remaining } where:
 * - text: the semantic description if -t/--text was used
 * - ref: the ref if no -t/--text was used (first non-flag arg)
 * - remaining: remaining args after ref/text extraction
 */
function parseTextOption(args: string[]): { text?: string; ref?: string; remaining: string[] } {
  const textIdx = args.findIndex((a) => a === '-t' || a === '--text');
  if (textIdx !== -1 && args[textIdx + 1]) {
    // Using text-based selection
    const text = args[textIdx + 1];
    const remaining = [...args.slice(0, textIdx), ...args.slice(textIdx + 2)];
    return { text, remaining };
  }
  // Using ref-based selection
  if (args.length > 0 && !args[0].startsWith('-')) {
    return { ref: args[0], remaining: args.slice(1) };
  }
  return { remaining: args };
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

  ${colors.cyan}Navigation:${colors.reset}
    goto <url>              Navigate to URL
    back                    Navigate back in history
    forward                 Navigate forward in history
    reload                  Reload current page

  ${colors.cyan}Actions:${colors.reset}
    click <ref>             Click element
    fill <ref> <value>      Fill input field
    type <ref> <text>       Type text with delays
    press <key>             Press keyboard key
    hover <ref>             Hover over element
    scroll <dir> [amount]   Scroll page (up/down/left/right)
    scroll-into-view <ref>  Scroll element into view
    select <ref> <value>    Select dropdown option
    check <ref>             Check checkbox
    uncheck <ref>           Uncheck checkbox

  ${colors.cyan}Wait Commands:${colors.reset}
    wait <ms>               Wait for duration
    wait-for-selector <sel> Wait for CSS selector (--state visible|hidden|attached|detached)
    wait-for-load [state]   Wait for page load (load|domcontentloaded|networkidle)

  ${colors.cyan}Inspection:${colors.reset}
    snapshot [-i] [-c] [-d N] [--scope sel]
                            Get ARIA accessibility tree (with optional filtering)
    screenshot [file]       Save screenshot
    url                     Get current URL
    get-blocks              Get recorded test steps (JSON)
    status                  Get session status (includes app_url)

  ${colors.cyan}Logs:${colors.reset}
    logs-console            Get console logs [--level <level>] [--limit <n>]
    logs-network            Get network logs [--status <codes>] [--url-pattern <pat>] [--limit <n>]

  ${colors.cyan}Test Generation:${colors.reset}
    generate-test           Generate test YAML --name <name> [--app-config <id>] [--output <file>]

  ${colors.cyan}Session:${colors.reset}
    exit, quit              Exit REPL (prompts to close session)
    help                    Show this help

  ${colors.cyan}Semantic Selection:${colors.reset}
    Use -t "description" instead of ref for AI-based element selection:
      click -t "Login button"
      fill -t "email input" user@example.com
      check -t "Accept terms checkbox"

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
