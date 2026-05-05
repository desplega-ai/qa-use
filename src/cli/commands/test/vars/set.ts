/**
 * qa-use test vars set - Set a typed variable on a test (local YAML).
 *
 * Mutates `<file>` in place via yaml's Document API so comments and key
 * order survive a round-trip. Phase 3 adds `--id <uuid>` for remote RMW.
 *
 * Validation:
 *   --type / --lifetime / --context must match the runtime arrays in
 *   src/cli/lib/test-vars.ts (which mirror the auto-generated unions).
 *
 * Mutation rules:
 *   - --key + --value only            → simple form (`key: value`)
 *   - any of --type/--lifetime/...    → full form ({value, type, ...})
 *   - existing full form stays full form even if only --value is passed
 *
 * Sensitive-preserve:
 *   - On existing sensitive var, `--sensitive` without `--value` keeps the
 *     stored value (the YAML stays untouched on the value field).
 *   - On a new key, `--sensitive` without `--value` is an error (no value
 *     to preserve).
 */

import { Command } from 'commander';
import * as yaml from 'yaml';
import type { VariableEntry } from '../../../../types/test-definition.js';
import { error, formatError, success } from '../../../lib/output.js';
import {
  readVarsFromYamlFile,
  TEST_VARIABLE_CONTEXTS,
  TEST_VARIABLE_LIFETIMES,
  TEST_VARIABLE_TYPES,
  writeYamlFile,
} from '../../../lib/test-vars.js';

interface SetOptions {
  key?: string;
  value?: string;
  type?: string;
  lifetime?: string;
  context?: string;
  sensitive?: boolean;
}

function fail(msg: string): never {
  console.log(error(msg));
  process.exit(1);
}

function validateEnum(flag: string, value: string | undefined, allowed: readonly string[]): void {
  if (value === undefined) return;
  if (!allowed.includes(value)) {
    fail(`invalid value for --${flag}: '${value}'; allowed: ${allowed.join(', ')}`);
  }
}

/**
 * Determine whether the requested mutation requires the full-form shape.
 * Any non-value flag → full form; otherwise simple form is fine for new
 * entries (existing full-form entries always stay full form).
 */
function requiresFullForm(opts: SetOptions): boolean {
  return Boolean(opts.type || opts.lifetime || opts.context || opts.sensitive);
}

export const setCommand = new Command('set')
  .description('Set (create or update) a typed variable on a test (local YAML)')
  .argument('[file]', 'Path to a local test YAML file')
  .requiredOption('--key <key>', 'Variable name')
  .option('--value <value>', 'Variable value')
  .option(`--type <type>`, `Variable type (one of: ${TEST_VARIABLE_TYPES.join(', ')})`)
  .option(
    '--lifetime <lifetime>',
    `Variable lifetime (one of: ${TEST_VARIABLE_LIFETIMES.join(', ')})`
  )
  .option('--context <context>', `Variable context (one of: ${TEST_VARIABLE_CONTEXTS.join(', ')})`)
  .option('--sensitive', 'Mark the variable as sensitive (masked in list output)')
  .action(async (file: string | undefined, options: SetOptions) => {
    try {
      if (!file) {
        fail(
          'Missing target. Provide a YAML file path.\n  Usage: qa-use test vars set <file> --key <k> [...]'
        );
      }
      if (!options.key) fail('--key is required');

      validateEnum('type', options.type, TEST_VARIABLE_TYPES);
      validateEnum('lifetime', options.lifetime, TEST_VARIABLE_LIFETIMES);
      validateEnum('context', options.context, TEST_VARIABLE_CONTEXTS);

      const { doc } = await readVarsFromYamlFile(file as string);

      // Read the existing entry. yaml v2 returns a YAMLMap/YAMLSeq for nested
      // collections even without `keepScalar`, so for full-form entries we
      // walk the node directly; for simple-form values we get the JS scalar.
      const existingRaw = doc.getIn(['variables', options.key]) as unknown;
      const existsAsFull = yaml.isMap(existingRaw);
      const existsAsSimple = !existsAsFull && existingRaw !== undefined && existingRaw !== null;
      const existingFull: VariableEntry | undefined = existsAsFull
        ? ((existingRaw as yaml.YAMLMap).toJSON() as VariableEntry)
        : undefined;

      const sensitivePreserve =
        options.sensitive === true &&
        options.value === undefined &&
        existsAsFull &&
        existingFull?.is_sensitive === true;

      if (options.sensitive === true && options.value === undefined && !sensitivePreserve) {
        fail(
          `cannot set --sensitive without --value on ${
            existingRaw === undefined ? 'a new key' : 'a non-sensitive key'
          }: '${options.key}'`
        );
      }

      // Decide between simple form and full form.
      const upgradeToFull = requiresFullForm(options) || existsAsFull;

      // Make sure `variables:` exists.
      if (!doc.hasIn(['variables'])) {
        doc.setIn(['variables'], doc.createNode({}));
      }

      if (!upgradeToFull) {
        // Simple form set
        if (options.value === undefined) {
          fail('--value is required when no other flags are passed');
        }
        const coerced = coerceScalar(options.value as string);
        doc.setIn(['variables', options.key], coerced);
      } else {
        // Full form set — upsert each provided field, preserving the rest.
        if (!existsAsFull) {
          // Create a fresh full-form entry (carry over a pre-existing simple value if any).
          const seed: VariableEntry = {
            value:
              options.value !== undefined
                ? coerceScalar(options.value)
                : existsAsSimple
                  ? (existingRaw as string | number)
                  : '',
            type: (options.type as VariableEntry['type']) ?? 'custom',
            lifetime: (options.lifetime as VariableEntry['lifetime']) ?? 'test',
            context: (options.context as VariableEntry['context']) ?? 'test',
            is_sensitive: options.sensitive === true,
          };
          doc.setIn(['variables', options.key], doc.createNode(seed));
        } else {
          // Existing full form: only set the provided fields. Don't disturb others.
          const path = ['variables', options.key];
          if (options.value !== undefined) {
            doc.setIn([...path, 'value'], coerceScalar(options.value));
          }
          if (options.type !== undefined) {
            doc.setIn([...path, 'type'], options.type);
          }
          if (options.lifetime !== undefined) {
            doc.setIn([...path, 'lifetime'], options.lifetime);
          }
          if (options.context !== undefined) {
            doc.setIn([...path, 'context'], options.context);
          }
          if (options.sensitive === true) {
            doc.setIn([...path, 'is_sensitive'], true);
          }
        }
      }

      await writeYamlFile(file as string, doc);
      console.log(success(`Set variable '${options.key}' in ${file}`));
    } catch (err) {
      console.log(error(`Failed to set variable: ${formatError(err)}`));
      process.exit(1);
    }
  });

/**
 * Coerce a CLI string argument to its likely scalar shape: integer/float when
 * parseable, otherwise the original string. Mirrors how cope's YAML loader
 * round-trips numeric values without quoting.
 */
function coerceScalar(s: string): string | number {
  if (s === '') return s;
  if (/^-?\d+$/.test(s)) {
    const n = Number.parseInt(s, 10);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^-?\d+\.\d+$/.test(s)) {
    const n = Number.parseFloat(s);
    if (Number.isFinite(n)) return n;
  }
  return s;
}
