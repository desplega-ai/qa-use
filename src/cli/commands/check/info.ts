/**
 * qa-use check info - Show detailed remote API check information
 */

import { Command } from 'commander';
import { apiCall, requireApiKey } from '../../lib/api-helpers.js';
import { loadConfig } from '../../lib/config.js';
import { error, formatError } from '../../lib/output.js';
import { formatStatus, formatTimestamp } from '../../lib/table.js';

const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

function formatField(label: string, value: string | undefined | null): string {
  const display = value ?? '-';
  return `  ${colors.gray}${label.padEnd(24)}${colors.reset} ${display}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function formatCheckValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'none';
    return JSON.stringify(value);
  }
  if (isPlainObject(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}

export function summarizeObject(value: unknown): string {
  if (value === undefined || value === null) return 'none';
  if (!isPlainObject(value)) return formatCheckValue(value);

  const keys = Object.keys(value);
  if (keys.length === 0) return 'empty object';

  const visibleKeys = keys.slice(0, 5).join(', ');
  const suffix = keys.length > 5 ? `, +${keys.length - 5} more` : '';
  return `${keys.length} key${keys.length === 1 ? '' : 's'}: ${visibleKeys}${suffix}`;
}

export function summarizeArray(value: unknown): string {
  if (value === undefined || value === null) return 'none';
  if (!Array.isArray(value)) return formatCheckValue(value);
  if (value.length === 0) return 'none';
  return `${value.length} item${value.length === 1 ? '' : 's'}: ${JSON.stringify(value)}`;
}

export function getCheckStatus(check: Record<string, unknown>): string {
  return String(check.status ?? check.run_status ?? '-');
}

export function renderCheckDetails(check: Record<string, unknown>): string {
  return [
    `${colors.cyan}Check Details${colors.reset}`,
    '',
    formatField('ID', String(check.id ?? '-')),
    formatField('Name', String(check.name ?? '-')),
    formatField('Description', String(check.description ?? '-')),
    formatField('Type', String(check.check_type ?? '-')),
    formatField('App Config', String(check.app_config_id ?? '-')),
    formatField('Status', formatStatus(getCheckStatus(check))),
    formatField('Alias', formatCheckValue(check.alias)),
    formatField('Created', formatTimestamp(String(check.created_at ?? ''))),
    formatField('Updated', formatTimestamp(String(check.updated_at ?? ''))),
    '',
    `  ${colors.gray}Config and Validation:${colors.reset}`,
    formatField('  Config', summarizeObject(check.config)),
    formatField('  Validation', summarizeObject(check.validation)),
    formatField('  Variables', summarizeArray(check.variables)),
    '',
    `  ${colors.gray}Dependencies and Captures:${colors.reset}`,
    formatField('  Check Dependencies', summarizeArray(check.check_dependency_ids)),
    formatField('  Test Dependency', formatCheckValue(check.test_dependency_id)),
    formatField('  Dependency Cache TTL', formatCheckValue(check.dependency_cache_ttl_seconds)),
    formatField('  Output Captures', summarizeArray(check.output_captures)),
    '',
    `  ${colors.gray}Retry and Timeout:${colors.reset}`,
    formatField('  Retry Strategy', formatCheckValue(check.retry_strategy)),
    formatField('  Max Retries', formatCheckValue(check.max_retries)),
    formatField('  Retry Delay Seconds', formatCheckValue(check.retry_delay_seconds)),
    formatField('  Backoff Multiplier', formatCheckValue(check.backoff_multiplier)),
    formatField('  Timeout MS', formatCheckValue(check.timeout_ms)),
  ].join('\n');
}

export const infoCommand = new Command('info')
  .description('Show detailed remote API check information')
  .argument('<check-id>', 'Check ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(async (checkId: string, options: { json?: boolean }) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const check = (await apiCall(config, 'GET', `/api/v1/checks/${checkId}`)) as Record<
        string,
        unknown
      >;

      if (options.json) {
        console.log(JSON.stringify(check, null, 2));
        return;
      }

      console.log(renderCheckDetails(check));
    } catch (err) {
      console.log(error(`Failed to fetch check: ${formatError(err)}`));
      process.exit(1);
    }
  });
