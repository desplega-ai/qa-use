/**
 * qa-use check-schedule info - Show detailed remote check schedule information
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

function formatField(label: string, value: string | undefined | null): string {
  const display = value ?? '-';
  return `  ${colors.gray}${label.padEnd(28)}${colors.reset} ${display}`;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) return value.length === 0 ? 'none' : JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function summarizeArray(value: unknown): string {
  if (!Array.isArray(value)) return formatValue(value);
  if (value.length === 0) return 'none';
  return `${value.length} item${value.length === 1 ? '' : 's'}: ${JSON.stringify(value)}`;
}

function summarizeObject(value: unknown): string {
  if (value === undefined || value === null) return 'none';
  if (typeof value !== 'object' || Array.isArray(value)) return formatValue(value);

  const keys = Object.keys(value);
  if (keys.length === 0) return 'empty object';

  const visibleKeys = keys.slice(0, 5).join(', ');
  const suffix = keys.length > 5 ? `, +${keys.length - 5} more` : '';
  return `${keys.length} key${keys.length === 1 ? '' : 's'}: ${visibleKeys}${suffix}`;
}

export function renderCheckScheduleDetails(schedule: Record<string, unknown>): string {
  return [
    `${colors.cyan}Check Schedule Details${colors.reset}`,
    '',
    formatField('ID', String(schedule.id ?? '-')),
    formatField('Name', String(schedule.name ?? '-')),
    formatField('Description', String(schedule.description ?? '-')),
    formatField('App Config', String(schedule.app_config_id ?? '-')),
    formatField('Cron Expression', String(schedule.cron_expression ?? '-')),
    formatField('Timezone', String(schedule.timezone ?? 'UTC')),
    formatField('Enabled', formatValue(schedule.enabled)),
    formatField('Failure Strategy', formatValue(schedule.failure_strategy)),
    formatField('Created', formatTimestamp(String(schedule.created_at ?? ''))),
    formatField('Updated', formatTimestamp(String(schedule.updated_at ?? ''))),
    '',
    `  ${colors.gray}Checks and Dependencies:${colors.reset}`,
    formatField('  Check IDs', summarizeArray(schedule.check_ids)),
    formatField(
      '  Dependency Conditions',
      summarizeObject(schedule.check_dependency_graph_conditions)
    ),
  ].join('\n');
}

export const infoCommand = new Command('info')
  .description('Show detailed remote check schedule information')
  .argument('<schedule-id>', 'Check schedule ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(async (scheduleId: string, options: { json?: boolean }) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const schedule = (await apiCall(
        config,
        'GET',
        `/api/v1/check-schedules/${scheduleId}`
      )) as Record<string, unknown>;

      if (options.json) {
        console.log(JSON.stringify(schedule, null, 2));
        return;
      }

      console.log(renderCheckScheduleDetails(schedule));
    } catch (err) {
      console.log(error(`Failed to fetch check schedule: ${formatError(err)}`));
      process.exit(1);
    }
  });
