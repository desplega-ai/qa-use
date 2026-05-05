/**
 * qa-use test vars set - Set a typed variable on a test.
 *
 * Local-file path: mutates `<file>` in place via yaml's Document API so
 * comments and key order survive a round-trip.
 *
 * Remote `--id` path: exports YAML, parses to a `TestDefinition`, mutates
 * the parsed object directly, and re-imports via `client.importTestDefinition`.
 * Comment/key-order preservation is meaningless across export → import — the
 * server normalizes formatting — so the Document API path is **not** used
 * remotely on purpose.
 *
 * Validation:
 *   --type / --lifetime / --context must match the runtime arrays in
 *   src/cli/lib/test-vars.ts (which mirror the auto-generated unions).
 *
 * Mutation rules (apply identically to both paths):
 *   - --key + --value only            → simple form (`key: value`)
 *   - any of --type/--lifetime/...    → full form ({value, type, ...})
 *   - existing full form stays full form even if only --value is passed
 *
 * Sensitive-preserve:
 *   - Existing sensitive var, `--sensitive` without `--value` → keep value.
 *     Locally we read from the file. Remotely we rely on cope's import-merge
 *     rule which keeps the stored DB value when is_sensitive=true and no
 *     value is supplied.
 *   - New key with `--sensitive` and no `--value` → exit 1.
 */

import { Command } from 'commander';
import * as yaml from 'yaml';
import type {
  TestDefinition,
  VariableEntry,
  Variables,
} from '../../../../types/test-definition.js';
import { createApiClient, loadConfig } from '../../../lib/config.js';
import { error, formatError, success } from '../../../lib/output.js';
import {
  readVarsFromYamlFile,
  resolveVarsTarget,
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
  id?: string;
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

interface ExistingShape {
  /** undefined when the key does not exist */
  raw: string | number | VariableEntry | undefined;
  isFull: boolean;
  isSimple: boolean;
  full?: VariableEntry;
}

/**
 * Apply common precondition checks (sensitive-without-value rules).
 * Throws via `fail` on violation; returns the resolved sensitive-preserve flag.
 */
function checkSensitivePreconditions(options: SetOptions, existing: ExistingShape): boolean {
  const sensitivePreserve =
    options.sensitive === true &&
    options.value === undefined &&
    existing.isFull &&
    existing.full?.is_sensitive === true;

  if (options.sensitive === true && options.value === undefined && !sensitivePreserve) {
    fail(
      `cannot set --sensitive without --value on ${
        existing.raw === undefined ? 'a new key' : 'a non-sensitive key'
      }: '${options.key}'`
    );
  }
  return sensitivePreserve;
}

/**
 * Apply the mutation to a parsed `Variables` object (used on the remote path
 * and for in-memory mutations during tests). Returns the updated map.
 */
function applyMutationToObject(vars: Variables, options: SetOptions): Variables {
  const key = options.key as string;
  const existingRaw = vars[key];
  const existsAsFull =
    existingRaw !== undefined && typeof existingRaw === 'object' && existingRaw !== null;
  const existing: ExistingShape = {
    raw: existingRaw,
    isFull: existsAsFull,
    isSimple: !existsAsFull && existingRaw !== undefined && existingRaw !== null,
    full: existsAsFull ? (existingRaw as VariableEntry) : undefined,
  };

  checkSensitivePreconditions(options, existing);

  const upgradeToFull = requiresFullForm(options) || existsAsFull;
  if (!upgradeToFull) {
    if (options.value === undefined) {
      fail('--value is required when no other flags are passed');
    }
    vars[key] = coerceScalar(options.value as string);
    return vars;
  }

  if (!existsAsFull) {
    const seed: VariableEntry = {
      value:
        options.value !== undefined
          ? coerceScalar(options.value)
          : existing.isSimple
            ? (existingRaw as string | number)
            : '',
      type: (options.type as VariableEntry['type']) ?? 'custom',
      lifetime: (options.lifetime as VariableEntry['lifetime']) ?? 'test',
      context: (options.context as VariableEntry['context']) ?? 'test',
      is_sensitive: options.sensitive === true,
    };
    vars[key] = seed;
    return vars;
  }

  const merged: VariableEntry = { ...(existingRaw as VariableEntry) };
  if (options.value !== undefined) merged.value = coerceScalar(options.value);
  if (options.type !== undefined) merged.type = options.type as VariableEntry['type'];
  if (options.lifetime !== undefined)
    merged.lifetime = options.lifetime as VariableEntry['lifetime'];
  if (options.context !== undefined) merged.context = options.context as VariableEntry['context'];
  if (options.sensitive === true) merged.is_sensitive = true;
  vars[key] = merged;
  return vars;
}

/**
 * Apply the mutation via the yaml.Document API so comments and key ordering
 * survive a write back to disk.
 */
function applyMutationToDocument(doc: yaml.Document, options: SetOptions): void {
  const key = options.key as string;
  const existingRaw = doc.getIn(['variables', key]) as unknown;
  const existsAsFull = yaml.isMap(existingRaw);
  const existing: ExistingShape = {
    raw: existingRaw as ExistingShape['raw'],
    isFull: existsAsFull,
    isSimple: !existsAsFull && existingRaw !== undefined && existingRaw !== null,
    full: existsAsFull ? ((existingRaw as yaml.YAMLMap).toJSON() as VariableEntry) : undefined,
  };

  checkSensitivePreconditions(options, existing);

  const upgradeToFull = requiresFullForm(options) || existsAsFull;

  if (!doc.hasIn(['variables'])) {
    doc.setIn(['variables'], doc.createNode({}));
  }

  if (!upgradeToFull) {
    if (options.value === undefined) {
      fail('--value is required when no other flags are passed');
    }
    doc.setIn(['variables', key], coerceScalar(options.value as string));
    return;
  }

  if (!existsAsFull) {
    const seed: VariableEntry = {
      value:
        options.value !== undefined
          ? coerceScalar(options.value)
          : existing.isSimple
            ? (existingRaw as string | number)
            : '',
      type: (options.type as VariableEntry['type']) ?? 'custom',
      lifetime: (options.lifetime as VariableEntry['lifetime']) ?? 'test',
      context: (options.context as VariableEntry['context']) ?? 'test',
      is_sensitive: options.sensitive === true,
    };
    doc.setIn(['variables', key], doc.createNode(seed));
    return;
  }

  const path = ['variables', key];
  if (options.value !== undefined) doc.setIn([...path, 'value'], coerceScalar(options.value));
  if (options.type !== undefined) doc.setIn([...path, 'type'], options.type);
  if (options.lifetime !== undefined) doc.setIn([...path, 'lifetime'], options.lifetime);
  if (options.context !== undefined) doc.setIn([...path, 'context'], options.context);
  if (options.sensitive === true) doc.setIn([...path, 'is_sensitive'], true);
}

export const setCommand = new Command('set')
  .description('Set (create or update) a typed variable on a test (local YAML or remote --id)')
  .argument('[file]', 'Path to a local test YAML file')
  .option('--id <uuid>', 'Remote test UUID — exports YAML, mutates, re-imports')
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
      const target = resolveVarsTarget({ file, id: options.id });
      if (!options.key) fail('--key is required');

      validateEnum('type', options.type, TEST_VARIABLE_TYPES);
      validateEnum('lifetime', options.lifetime, TEST_VARIABLE_LIFETIMES);
      validateEnum('context', options.context, TEST_VARIABLE_CONTEXTS);

      if (target.kind === 'file') {
        const { doc } = await readVarsFromYamlFile(target.path);
        applyMutationToDocument(doc, options);
        await writeYamlFile(target.path, doc);
        console.log(success(`Set variable '${options.key}' in ${target.path}`));
        return;
      }

      // Remote --id path: read-modify-write via export → import.
      const config = await loadConfig();
      const client = createApiClient(config);
      const yamlText = await client.exportTest(target.uuid, 'yaml', false);
      const def = (yaml.parse(yamlText) as TestDefinition | null) ?? ({} as TestDefinition);
      def.variables = applyMutationToObject(def.variables ?? {}, options);
      const result = await client.importTestDefinition([def]);
      if (result?.success === false) {
        fail(`import failed: ${JSON.stringify(result)}`);
      }
      console.log(success(`Set variable '${options.key}' on test ${target.uuid}`));
    } catch (err) {
      console.log(error(`Failed to set variable: ${formatError(err)}`));
      process.exit(1);
    }
  });
