/**
 * qa-use test vars list - List typed variables on a test.
 *
 * Local-file path (`<file>` positional) is the primary surface; `--id <uuid>`
 * exports the YAML from the backend in-memory and runs the same rendering
 * path. Mutual exclusion is enforced via `resolveVarsTarget`.
 */

import { Command } from 'commander';
import * as yaml from 'yaml';
import type {
  TestDefinition,
  VariableEntry,
  Variables,
} from '../../../../types/test-definition.js';
import { createApiClient, loadConfig } from '../../../lib/config.js';
import { error, formatError } from '../../../lib/output.js';
import { type Column, printTable } from '../../../lib/table.js';
import {
  getNormalizedEntry,
  maskValue,
  readVarsFromYamlFile,
  resolveVarsTarget,
} from '../../../lib/test-vars.js';

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
  .description('List typed variables on a test (local YAML file or remote --id)')
  .argument('[file]', 'Path to a local test YAML file')
  .option('--id <uuid>', 'Remote test UUID — exports YAML and lists from there')
  .option('--json', 'Output as JSON (sensitive values redacted)')
  .action(async (file: string | undefined, options: { id?: string; json?: boolean }) => {
    try {
      const target = resolveVarsTarget({ file, id: options.id });

      let vars: Variables;
      if (target.kind === 'file') {
        ({ vars } = await readVarsFromYamlFile(target.path));
      } else {
        const config = await loadConfig();
        const client = createApiClient(config);
        const yamlText = await client.exportTest(target.uuid, 'yaml', false);
        const def = yaml.parse(yamlText) as TestDefinition | null;
        vars = def?.variables ?? {};
      }
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
        emptyMessage:
          target.kind === 'file'
            ? `No variables defined in ${target.path}`
            : `No variables on test ${target.uuid}`,
      });
    } catch (err) {
      console.log(error(`Failed to list variables: ${formatError(err)}`));
      process.exit(1);
    }
  });
