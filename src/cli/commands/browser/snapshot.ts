/**
 * qa-use browser snapshot - Get ARIA accessibility tree
 */

import { Command } from 'commander';
import { BrowserApiClient } from '../../../../lib/api/browser.js';
import { resolveSessionId, touchSession } from '../../lib/browser-sessions.js';
import { loadConfig } from '../../lib/config.js';
import { error } from '../../lib/output.js';

interface SnapshotOptions {
  sessionId?: string;
  json?: boolean;
  interactive?: boolean;
  compact?: boolean;
  maxDepth?: string; // Commander parses as string
  scope?: string;
}

export const snapshotCommand = new Command('snapshot')
  .description('Get the ARIA accessibility tree snapshot')
  .option('-s, --session-id <id>', 'Session ID (auto-resolved if only one session)')
  .option('--json', 'Output raw JSON instead of formatted tree')
  .option('-i, --interactive', 'Only include interactive elements (buttons, inputs, links)')
  .option('-c, --compact', 'Remove empty structural elements')
  .option('-d, --max-depth <n>', 'Limit tree depth (1-20)')
  .option('--scope <selector>', 'CSS selector to scope snapshot (e.g., "#main")')
  .action(async (options: SnapshotOptions) => {
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

      // Get snapshot with filtering options
      const snapshot = await client.getSnapshot(resolved.id, {
        interactive: options.interactive,
        compact: options.compact,
        max_depth: options.maxDepth ? parseInt(options.maxDepth, 10) : undefined,
        scope: options.scope,
      });

      if (options.json) {
        // Output raw JSON
        console.log(JSON.stringify(snapshot, null, 2));
      } else {
        // Output formatted ARIA tree
        if (snapshot.url) {
          console.log(`URL: ${snapshot.url}\n`);
        }
        if (snapshot.filter_stats) {
          console.log(
            `Filtered: ${snapshot.filter_stats.filtered_lines}/${snapshot.filter_stats.original_lines} lines (${snapshot.filter_stats.reduction_percent}% reduction)\n`
          );
        }
        console.log(formatAriaTree(snapshot.snapshot));
      }

      // Update session timestamp
      await touchSession(resolved.id);
    } catch (err) {
      console.log(error(err instanceof Error ? err.message : 'Failed to get snapshot'));
      process.exit(1);
    }
  });

/**
 * Format ARIA tree with highlighted refs
 */
function formatAriaTree(tree: string): string {
  // ANSI color codes
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    yellow: '\x1b[33m',
  };

  // Highlight refs like [ref=e3]
  const highlighted = tree.replace(/\[ref=(\w+)\]/g, (match, ref) => {
    return `${colors.cyan}[ref=${colors.yellow}${ref}${colors.cyan}]${colors.reset}`;
  });

  // Highlight element types (heading, button, link, textbox, etc.)
  const withElements = highlighted.replace(
    /^(\s*-\s+)(heading|button|link|textbox|combobox|listbox|checkbox|radio|menu|menuitem|dialog|img|paragraph|list|listitem|table|row|cell|tab|tablist|tabpanel)/gm,
    (match, prefix, element) => {
      return `${prefix}${colors.green}${element}${colors.reset}`;
    }
  );

  return withElements;
}
