/**
 * qa-use browser status - Get session status
 *
 * Phase 4 extension: when invoked with `--list` (or no `-s` id and no
 * stored session is auto-resolvable), list detached sessions from the
 * PID-file directory and mark stale entries.
 */

import { Command } from 'commander';
import {
  isPidAlive,
  listSessionRecords,
  readSessionRecord,
  removeSessionRecord,
} from '../../../../lib/env/sessions.js';
import { resolveSessionId } from '../../lib/browser-sessions.js';
import { createBrowserClient, loadConfig } from '../../lib/config.js';
import { error, info, warning } from '../../lib/output.js';

interface StatusOptions {
  sessionId?: string;
  json?: boolean;
  list?: boolean;
}

function formatExpiresIn(expiresAt: number): string {
  const remainMs = expiresAt - Date.now();
  if (remainMs <= 0) return 'expired';
  const seconds = Math.floor(remainMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

async function runListMode(options: StatusOptions): Promise<void> {
  const records = listSessionRecords().filter((r) => {
    // Skip pending/phase records that don't correspond to real sessions
    // (they are keyed by spawn-id, identifiable by `phase` field).
    return !('phase' in r);
  });

  if (options.json) {
    const augmented = records.map((r) => ({
      ...r,
      stale: !isPidAlive(r.pid),
      expiresIn: formatExpiresIn(r.ttlExpiresAt),
    }));
    console.log(JSON.stringify(augmented, null, 2));
    return;
  }

  if (records.length === 0) {
    console.log(info('No detached browser sessions.'));
    return;
  }

  console.log('');
  console.log(`${'ID'.padEnd(36)}  ${'PID'.padEnd(8)}  ${'PUBLIC URL'.padEnd(40)}  EXPIRES IN`);
  console.log('-'.repeat(120));
  for (const r of records) {
    const stale = !isPidAlive(r.pid);
    const staleLabel = stale ? ' (stale — run `qa-use doctor`)' : '';
    const publicUrl = r.publicUrl ?? '(no tunnel)';
    console.log(
      `${r.id.padEnd(36)}  ${String(r.pid).padEnd(8)}  ${publicUrl.padEnd(40)}  ${formatExpiresIn(r.ttlExpiresAt)}${staleLabel}`
    );
  }
  console.log('');
}

export const statusCommand = new Command('status')
  .description('Get session status and details (or list detached sessions with --list)')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--json', 'Output as JSON')
  .option('-l, --list', 'List all detached sessions from PID files')
  .action(async (options: StatusOptions) => {
    try {
      // List mode — scan PID-file directory.
      if (options.list) {
        await runListMode(options);
        return;
      }

      // Load configuration
      const config = await loadConfig();
      if (!config.api_key) {
        console.log(error('API key not configured. Run `qa-use setup` first.'));
        process.exit(1);
      }

      // Create client and set API key
      const client = createBrowserClient(config);

      // Resolve session ID
      const resolved = await resolveSessionId({
        explicitId: options.sessionId,
        client,
        verify: false, // We'll get the session anyway
      });

      // Attempt to read PID file for this session — if one exists the
      // session is detached and we can show PID + stale state.
      const pidRecord = readSessionRecord(resolved.id);

      // Get session details
      const session = await client.getSession(resolved.id);

      if (options.json) {
        const out: Record<string, unknown> = { ...session };
        if (pidRecord) {
          out.detached = {
            pid: pidRecord.pid,
            publicUrl: pidRecord.publicUrl,
            stale: !isPidAlive(pidRecord.pid),
            startedAt: pidRecord.startedAt,
            ttlExpiresAt: pidRecord.ttlExpiresAt,
          };
        }
        console.log(JSON.stringify(out, null, 2));
        return;
      }

      // Human-readable output
      console.log('');
      console.log(`Session ID:   ${session.id}`);

      // Status with color
      let statusDisplay: string;
      switch (session.status) {
        case 'active':
          statusDisplay = `\x1b[32m${session.status}\x1b[0m`; // Green
          break;
        case 'starting':
          statusDisplay = `\x1b[33m${session.status}\x1b[0m`; // Yellow
          break;
        case 'closed':
        case 'closing':
          statusDisplay = `\x1b[90m${session.status}\x1b[0m`; // Gray
          break;
        default:
          statusDisplay = session.status;
      }
      console.log(`Status:       ${statusDisplay}`);

      // Created time
      const createdAt = new Date(session.created_at);
      console.log(`Created:      ${createdAt.toISOString()}`);

      // Updated time if available
      if (session.updated_at) {
        const updatedAt = new Date(session.updated_at);
        console.log(`Updated:      ${updatedAt.toISOString()}`);
      }

      // Current URL
      if (session.current_url) {
        console.log(`URL:          ${session.current_url}`);
      }

      // App URL (for viewing session in UI)
      if (session.app_url) {
        console.log(`App URL:      ${session.app_url}`);
      }

      // CDP URL (Chrome DevTools Protocol WebSocket URL, only when active)
      if (session.cdp_url) {
        console.log(`CDP URL:      ${session.cdp_url}`);
      }

      // Last action time
      if (session.last_action_at) {
        const lastActionAt = new Date(session.last_action_at);
        console.log(`Last Action:  ${lastActionAt.toISOString()}`);
      }

      // Error message if present
      if (session.error_message) {
        console.log(`Error:        \x1b[31m${session.error_message}\x1b[0m`);
      }

      // Viewport
      if (session.viewport) {
        console.log(`Viewport:     ${session.viewport}`);
      }

      // Headless mode
      if (session.headless !== undefined) {
        console.log(`Headless:     ${session.headless}`);
      }

      // Timeout
      if (session.timeout) {
        console.log(`Timeout:      ${session.timeout}s`);
      }

      // Recording URLs (available after session closes)
      if (session.recording_url) {
        console.log(`Recording:    ${session.recording_url}`);
      }
      if (session.har_url) {
        console.log(`HAR File:     ${session.har_url}`);
      }
      if (session.storage_state_url) {
        console.log(`Storage:      ${session.storage_state_url}`);
      }

      // Detached-session annotations.
      if (pidRecord) {
        const stale = !isPidAlive(pidRecord.pid);
        console.log(
          `Detached PID: ${pidRecord.pid}${stale ? ' (stale — run `qa-use doctor`)' : ''}`
        );
        if (pidRecord.publicUrl) {
          console.log(`Public URL:   ${pidRecord.publicUrl}`);
        }
        console.log(`Expires In:   ${formatExpiresIn(pidRecord.ttlExpiresAt)}`);
        if (stale) {
          // Best-effort reap of the obviously-dead PID file so the next
          // status call is clean.
          removeSessionRecord(resolved.id);
          console.log(warning('PID file removed (process was dead)'));
        }
      }

      console.log('');

      // Show source if auto-resolved
      if (resolved.source === 'stored') {
        console.log(info('(Session auto-resolved from local storage)'));
      }
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to get session status'));
      process.exit(1);
    }
  });
