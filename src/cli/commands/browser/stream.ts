/**
 * qa-use browser stream - Real-time WebSocket event streaming
 */

import { Command } from 'commander';
import WebSocket from 'ws';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error, info } from '../../lib/output.js';

interface StreamOptions {
  sessionId?: string;
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

export const streamCommand = new Command('stream')
  .description('Stream real-time events from a browser session')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .action(async (options: StreamOptions) => {
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

      // Resolve session ID
      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
      });

      console.log(info(`Connecting to session ${resolved.id}...`));

      // Get WebSocket URL
      const wsUrl = client.getStreamUrl(resolved.id);

      // Create WebSocket connection
      const ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${client.getApiKey()}`,
        },
      });

      // Handle connection open
      ws.on('open', () => {
        console.log(info('Connected. Press Ctrl+C to disconnect.\n'));
        touchSession(resolved.id);
      });

      // Handle messages
      ws.on('message', (data: WebSocket.Data) => {
        try {
          // Handle binary data (screenshots)
          if (Buffer.isBuffer(data)) {
            console.log(
              `${colors.gray}📷 Binary frame received (${data.length} bytes)${colors.reset}`
            );
            return;
          }

          // Parse JSON message
          const message = JSON.parse(data.toString());
          formatEvent(message);
        } catch {
          console.log(`${colors.gray}Raw: ${data.toString()}${colors.reset}`);
        }
      });

      // Handle errors
      ws.on('error', (err) => {
        console.log(error(`WebSocket error: ${err.message}`));
      });

      // Handle close
      ws.on('close', (code, reason) => {
        console.log('');
        console.log(info(`Disconnected (code: ${code}, reason: ${reason.toString() || 'none'})`));
        process.exit(0);
      });

      // Handle Ctrl+C
      process.on('SIGINT', () => {
        console.log('');
        console.log(info('Disconnecting...'));
        ws.close();
      });
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to stream events'));
      process.exit(1);
    }
  });

/**
 * Format and print a WebSocket event
 */
function formatEvent(event: { type: string; data?: unknown; timestamp?: string }): void {
  const timestamp = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '';
  const timestampStr = timestamp ? `${colors.gray}[${timestamp}]${colors.reset} ` : '';

  switch (event.type) {
    case 'action_started': {
      const data = event.data as { action_type?: string; action_id?: string };
      console.log(
        `${timestampStr}${colors.blue}▶${colors.reset} Action started: ${data.action_type || 'unknown'}`
      );
      break;
    }

    case 'action_completed': {
      const data = event.data as { success?: boolean; error?: string };
      if (data.success) {
        console.log(`${timestampStr}${colors.green}✓${colors.reset} Action completed`);
      } else {
        console.log(
          `${timestampStr}${colors.red}✗${colors.reset} Action failed: ${data.error || 'unknown error'}`
        );
      }
      break;
    }

    case 'status_changed': {
      const data = event.data as { status?: string };
      console.log(`${timestampStr}${colors.cyan}⚡${colors.reset} Status: ${data.status}`);
      break;
    }

    case 'error': {
      const data = event.data as { message?: string; code?: string };
      console.log(
        `${timestampStr}${colors.red}✗${colors.reset} Error: ${data.message || 'unknown'}`
      );
      break;
    }

    case 'closed': {
      const data = event.data as { reason?: string };
      console.log(
        `${timestampStr}${colors.yellow}●${colors.reset} Session closed${data?.reason ? `: ${data.reason}` : ''}`
      );
      break;
    }

    case 'pong':
      // Silently ignore pong responses
      break;

    default:
      console.log(
        `${timestampStr}${colors.gray}[${event.type}]${colors.reset} ${JSON.stringify(event.data || {})}`
      );
  }
}
