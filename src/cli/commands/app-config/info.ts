/**
 * qa-use app-config info - Show detailed app configuration
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
  .description('Show detailed app configuration')
  .argument('<id>', 'App configuration ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const appConfig = (await apiCall(config, 'GET', `/api/v1/app-configs/${id}`)) as Record<
        string,
        unknown
      >;

      if (options.json) {
        console.log(JSON.stringify(appConfig, null, 2));
        return;
      }

      console.log(`${colors.cyan}App Configuration Details${colors.reset}\n`);

      printField('ID', String(appConfig.id ?? '-'));
      printField('Name', String(appConfig.name ?? '-'));
      printField('App URL', String(appConfig.app_url ?? '-'));
      printField('Created', formatTimestamp(String(appConfig.created_at ?? '')));
      printField('Updated', formatTimestamp(String(appConfig.updated_at ?? '')));

      // Auth config if present
      const auth = appConfig.auth;
      if (auth && typeof auth === 'object') {
        console.log(`\n  ${colors.gray}Auth:${colors.reset}`);
        const authObj = auth as Record<string, unknown>;
        for (const [key, value] of Object.entries(authObj)) {
          if (value !== undefined && value !== null) {
            const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
            printField(`  ${key}`, display);
          }
        }
      }

      // Selectors if present
      const selectors = appConfig.selectors;
      if (selectors && typeof selectors === 'object') {
        console.log(`\n  ${colors.gray}Selectors:${colors.reset}`);
        const selObj = selectors as Record<string, unknown>;
        for (const [key, value] of Object.entries(selObj)) {
          if (value !== undefined && value !== null) {
            const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
            printField(`  ${key}`, display);
          }
        }
      }
    } catch (err) {
      console.log(error(`Failed to fetch app configuration: ${formatError(err)}`));
      process.exit(1);
    }
  });
