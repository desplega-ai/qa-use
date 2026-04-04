/**
 * qa-use persona info - Show detailed persona information
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
  .description('Show detailed persona information')
  .argument('<id>', 'Persona ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const persona = (await apiCall(config, 'GET', `/api/v1/personas/${id}`)) as Record<
        string,
        unknown
      >;

      if (options.json) {
        console.log(JSON.stringify(persona, null, 2));
        return;
      }

      console.log(`${colors.cyan}Persona Details${colors.reset}\n`);

      printField('ID', String(persona.id ?? '-'));
      printField('Name', String(persona.name ?? '-'));
      printField('Description', String(persona.description ?? '-'));
      printField('Created', formatTimestamp(String(persona.created_at ?? '')));
      printField('Updated', formatTimestamp(String(persona.updated_at ?? '')));

      // Print any additional top-level fields that aren't already shown
      const knownKeys = new Set(['id', 'name', 'description', 'created_at', 'updated_at']);
      for (const [key, value] of Object.entries(persona)) {
        if (knownKeys.has(key) || value === undefined || value === null) continue;
        const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
        printField(key, display);
      }
    } catch (err) {
      console.log(error(`Failed to fetch persona: ${formatError(err)}`));
      process.exit(1);
    }
  });
