/**
 * qa-use issues info - Show detailed issue information
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
  .description('Show detailed issue information')
  .argument('<id>', 'Issue ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const issue = (await apiCall(config, 'GET', `/api/v1/issues/${id}`)) as Record<
        string,
        unknown
      >;

      if (options.json) {
        console.log(JSON.stringify(issue, null, 2));
        return;
      }

      console.log(`${colors.cyan}Issue Details${colors.reset}\n`);

      printField('ID', String(issue.id ?? '-'));
      printField('Title', String(issue.title ?? '-'));
      printField('Description', String(issue.description ?? '-'));
      printField('Status', String(issue.status ?? '-'));
      printField('Severity', String(issue.severity ?? '-'));
      printField('First Seen', formatTimestamp(String(issue.first_seen ?? '')));
      printField('Last Seen', formatTimestamp(String(issue.last_seen ?? '')));
      printField('Occurrences', String(issue.occurrence_count ?? '-'));

      // Affected tests
      const affectedTests = issue.affected_tests ?? issue.test_ids;
      if (Array.isArray(affectedTests) && affectedTests.length > 0) {
        console.log(`\n  ${colors.gray}Affected Tests (${affectedTests.length}):${colors.reset}`);
        for (const tid of affectedTests) {
          console.log(`    - ${tid}`);
        }
      } else {
        printField('Affected Tests', 'none');
      }
    } catch (err) {
      console.log(error(`Failed to fetch issue: ${formatError(err)}`));
      process.exit(1);
    }
  });
