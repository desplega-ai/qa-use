/**
 * qa-use test runs steps - Show step-by-step execution details
 */

import { Command } from 'commander';
import { apiCall, requireApiKey } from '../../../lib/api-helpers.js';
import { loadConfig } from '../../../lib/config.js';
import { error, formatError } from '../../../lib/output.js';
import {
  type Column,
  formatDuration,
  formatStatus,
  printTable,
  truncate,
} from '../../../lib/table.js';

const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
};

export const stepsCommand = new Command('steps')
  .description('Show step-by-step execution details for a test run')
  .argument('<run-id>', 'Test run ID (UUID)')
  .option('--json', 'Output as JSON')
  .option('--verbose', 'Show full step details including logs and errors')
  .action(async (runId, options) => {
    try {
      const config = await loadConfig();
      requireApiKey(config);

      const data = (await apiCall(config, 'GET', `/api/v1/test-runs/${runId}/steps`)) as unknown;

      // Handle both array and object responses
      const steps = Array.isArray(data)
        ? data
        : (data as Record<string, unknown>).steps
          ? ((data as Record<string, unknown>).steps as unknown[])
          : [];

      if (options.json) {
        console.log(JSON.stringify(steps, null, 2));
        return;
      }

      const rows: Record<string, unknown>[] = (steps as Array<Record<string, unknown>>).map(
        (step, idx) => ({
          ...step,
          _index: step.step_index ?? step.index ?? idx + 1,
        })
      );

      const columns: Column[] = [
        {
          key: '_index',
          header: 'STEP#',
          width: 6,
          format: (v) => String(v ?? '-'),
        },
        {
          key: 'name',
          header: 'ACTION',
          width: 40,
          format: (v) => truncate(String(v ?? '-'), 40),
        },
        {
          key: 'status',
          header: 'STATUS',
          width: 11,
          format: (v) => formatStatus(String(v ?? '-')),
        },
        {
          key: 'duration',
          header: 'DURATION',
          width: 10,
          format: (v) => {
            // Handle both seconds and milliseconds
            const num = v as number | undefined;
            return formatDuration(num);
          },
        },
      ];

      if (options.verbose) {
        columns.push({
          key: 'error',
          header: 'ERROR',
          width: 50,
          format: (v) => {
            if (!v) return '-';
            return `${colors.red}${truncate(String(v), 50)}${colors.reset}`;
          },
        });
      }

      printTable(columns, rows, {
        json: false,
        title: `Steps for run ${runId}`,
        emptyMessage: `No steps found for run ${runId}`,
      });

      // In verbose mode, print full error details after the table
      if (options.verbose) {
        for (const step of rows) {
          const stepError = step.error ?? step.error_message;
          const logs = step.logs as string[] | undefined;

          if (stepError || (logs && logs.length > 0)) {
            console.log(
              `\n${colors.gray}── Step ${step._index}: ${step.name ?? 'unknown'} ──${colors.reset}`
            );

            if (stepError) {
              console.log(`  ${colors.red}Error:${colors.reset} ${stepError}`);
            }

            if (logs && logs.length > 0) {
              console.log(`  ${colors.gray}Logs:${colors.reset}`);
              for (const log of logs) {
                console.log(`    ${colors.gray}${log}${colors.reset}`);
              }
            }
          }
        }
      }
    } catch (err) {
      console.log(error(`Failed to fetch steps: ${formatError(err)}`));
      process.exit(1);
    }
  });
