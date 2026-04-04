/**
 * qa-use app-context info - Show detailed app context
 */

import { Command } from 'commander';
import { apiCall, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError } from '../../lib/output.js';
import { formatTimestamp } from '../../lib/table.js';

const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

function printField(label: string, value: string | undefined | null): void {
  const display = value ?? '-';
  console.log(`  ${colors.gray}${label.padEnd(18)}${colors.reset} ${display}`);
}

export const infoCommand = new Command('info')
  .description('Show detailed app context')
  .argument('<id>', 'App context ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const appContext = (await apiCall(config, 'GET', `/api/v1/app-contexts/${id}`)) as Record<
        string,
        unknown
      >;

      if (options.json) {
        console.log(JSON.stringify(appContext, null, 2));
        return;
      }

      console.log(`${colors.cyan}App Context Details${colors.reset}\n`);

      printField('ID', String(appContext.id ?? '-'));
      printField('Name', String(appContext.name ?? '-'));
      printField('Description', String(appContext.description ?? '-'));
      printField('Created', formatTimestamp(String(appContext.created_at ?? '')));
      printField('Updated', formatTimestamp(String(appContext.updated_at ?? '')));

      // Print any additional top-level fields
      const knownKeys = new Set(['id', 'name', 'description', 'created_at', 'updated_at']);
      for (const [key, value] of Object.entries(appContext)) {
        if (knownKeys.has(key) || value === undefined || value === null) continue;
        const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        printField(key, display);
      }
    } catch (err) {
      console.log(error(`Failed to fetch app context: ${formatError(err)}`));
      process.exit(1);
    }
  });
