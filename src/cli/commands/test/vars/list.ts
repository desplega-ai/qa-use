/**
 * qa-use test vars list - List typed variables on a test.
 *
 * Phase 1: local-file path only. `--id <uuid>` is wired up in Phase 3.
 */

import { Command } from 'commander';
import type { VariableEntry, Variables } from '../../../../types/test-definition.js';
import { error, formatError } from '../../../lib/output.js';
import { type Column, printTable } from '../../../lib/table.js';
import { getNormalizedEntry, maskValue, readVarsFromYamlFile } from '../../../lib/test-vars.js';

interface VarRow {
  key: string;
  type: string;
  lifetime: string;
  context: string;
  is_sensitive: boolean;
  value: string;
  /** Used for `--json` output — raw value (omitted entirely when sensitive) */
  rawValue?: string | number;
}

function buildRow(key: string, raw: string | number | VariableEntry): VarRow {
  const entry = getNormalizedEntry(raw);
  return {
    key,
    type: entry.type ?? 'custom',
    lifetime: entry.lifetime ?? 'test',
    context: entry.context ?? 'test',
    is_sensitive: entry.is_sensitive ?? false,
    value: maskValue(raw),
    rawValue: entry.value ?? undefined,
  };
}

function rowsFromVariables(vars: Variables): VarRow[] {
  return Object.entries(vars).map(([k, v]) => buildRow(k, v));
}

/**
 * Build the JSON payload emitted by `--json`.
 * Sensitive entries omit the `value` key entirely so consumers rely on
 * `is_sensitive: true` as the redaction signal.
 */
function rowsForJson(rows: VarRow[]): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const out: Record<string, unknown> = {
      key: row.key,
      type: row.type,
      lifetime: row.lifetime,
      context: row.context,
      is_sensitive: row.is_sensitive,
    };
    if (!row.is_sensitive && row.rawValue !== undefined) {
      out.value = row.rawValue;
    }
    return out;
  });
}

export const listCommand = new Command('list')
  .description('List typed variables on a test (local YAML file)')
  .argument('[file]', 'Path to a local test YAML file')
  .option('--json', 'Output as JSON (sensitive values redacted)')
  .action(async (file: string | undefined, options: { json?: boolean }) => {
    try {
      if (!file) {
        console.log(error('Missing target. Provide a YAML file path.'));
        console.log('  Usage: qa-use test vars list <file>');
        process.exit(1);
      }

      const { vars } = await readVarsFromYamlFile(file);
      const rows = rowsFromVariables(vars);

      if (options.json) {
        console.log(JSON.stringify(rowsForJson(rows), null, 2));
        return;
      }

      const columns: Column[] = [
        { key: 'key', header: 'KEY' },
        { key: 'type', header: 'TYPE' },
        { key: 'lifetime', header: 'LIFETIME' },
        { key: 'context', header: 'CONTEXT' },
        {
          key: 'is_sensitive',
          header: 'SENSITIVE',
          format: (v) => (v ? 'yes' : 'no'),
        },
        { key: 'value', header: 'VALUE' },
      ];

      printTable(columns as unknown as Column[], rows as unknown as Record<string, unknown>[], {
        emptyMessage: `No variables defined in ${file}`,
      });
    } catch (err) {
      console.log(error(`Failed to list variables: ${formatError(err)}`));
      process.exit(1);
    }
  });
