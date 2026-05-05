/**
 * Helpers for the imperative `qa-use test vars` CLI surface.
 *
 * Owns YAML mutation primitives, sensitive-aware masking, and a runtime
 * mirror of the `Type` / `Lifetime` / `Context` enums from the auto-generated
 * `src/types/test-definition.ts`. Mutual-extends checks compile-time-fail if
 * regenerated types drift from the runtime arrays.
 */

import * as fs from 'node:fs/promises';
import * as yaml from 'yaml';
import type {
  Context as VariableContext,
  VariableEntry,
  Lifetime as VariableLifetime,
  Variables,
  Type as VariableType,
} from '../../types/test-definition.js';
import { isFullUuid } from './uuid.js';

// ---------------------------------------------------------------------------
// Runtime enum mirrors (kept in sync with src/types/test-definition.ts)
// ---------------------------------------------------------------------------

export const TEST_VARIABLE_TYPES = [
  'custom',
  'company_name',
  'random_string',
  'random_number',
  'first_name',
  'last_name',
  'full_name',
  'username',
  'address',
  'phone_number',
  'city',
  'country',
  'url',
  'email',
  'password',
  'email_message',
  'sensitive',
  'text',
  'uuid',
  'slug',
] as const satisfies readonly VariableType[];

export const TEST_VARIABLE_LIFETIMES = [
  'all',
  'test',
  'suite',
] as const satisfies readonly VariableLifetime[];

export const TEST_VARIABLE_CONTEXTS = [
  'test',
  'suite',
  'persona',
  'app_config',
  'global',
] as const satisfies readonly VariableContext[];

// Compile-time mutual-extends guard: fails `bun run typecheck` if the auto-generated
// union drifts from the runtime arrays above (e.g. after `bun run generate:types`).
// The exported `_VAR_ENUM_DRIFT_GUARD` is intentionally not consumed at runtime —
// its only job is to keep these conditional types live in the type graph.
type _AssertTypesCover = VariableType extends (typeof TEST_VARIABLE_TYPES)[number] ? true : never;
type _AssertLifetimesCover = VariableLifetime extends (typeof TEST_VARIABLE_LIFETIMES)[number]
  ? true
  : never;
type _AssertContextsCover = VariableContext extends (typeof TEST_VARIABLE_CONTEXTS)[number]
  ? true
  : never;
export const _VAR_ENUM_DRIFT_GUARD: [
  _AssertTypesCover,
  _AssertLifetimesCover,
  _AssertContextsCover,
] = [true, true, true];

// ---------------------------------------------------------------------------
// Variable normalization + masking
// ---------------------------------------------------------------------------

/**
 * Coerce a `Variables` map value (simple form `string | number` or full
 * `VariableEntry`) into a normalized `VariableEntry`.
 *
 * Simple-form values become `{ value: <as-is>, is_sensitive: false }`.
 * Full-form entries are returned as-is (no defaults injected here — defaults
 * live in `vars set`'s YAML serialization path).
 */
export function getNormalizedEntry(value: string | number | VariableEntry): VariableEntry {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { value: value as string | number, is_sensitive: false };
  }
  return value;
}

/**
 * Render the display value for a top-level variable entry, masking sensitive
 * values as `****`. Accepts the broad `Variables`-map union to match the
 * existing `info.ts` call sites without forcing a normalizer at every site.
 *
 * Does **not** truncate — truncation is a presentation concern that stays at
 * the caller (e.g. `info.ts` truncates to 50 chars).
 */
export function maskValue(value: string | number | VariableEntry): string {
  const entry = getNormalizedEntry(value);
  if (entry.is_sensitive) return '****';
  return String(entry.value ?? '');
}

// ---------------------------------------------------------------------------
// Post-import sanity checks (remote --id path)
// ---------------------------------------------------------------------------

/**
 * Verify a `set` mutation actually stuck after `importTestDefinition`.
 * `ImportResult.success` can be `true` while the per-test `action` is
 * `conflict`/`unchanged`, so the only reliable signal is to re-export and
 * compare against the entry we sent in the import payload.
 *
 * Returns `null` on match; otherwise a short reason describing the divergence.
 * Only fields that were explicitly set on `expected` are compared — so a
 * simple-form mutation tolerates the server normalizing to full form with
 * extra defaults.
 */
export function verifySetMutation(
  vars: Variables,
  key: string,
  expected: string | number | VariableEntry
): string | null {
  const actual = vars[key];
  if (actual === undefined) {
    return `variable '${key}' missing from post-import re-export`;
  }
  const expectedNorm = getNormalizedEntry(expected);
  const actualNorm = getNormalizedEntry(actual);

  const fields: (keyof VariableEntry)[] = ['value', 'type', 'lifetime', 'context', 'is_sensitive'];
  for (const field of fields) {
    const expVal = expectedNorm[field];
    if (expVal === undefined) continue;
    const actVal = actualNorm[field];
    if (actVal !== expVal) {
      return `field '${field}' on '${key}' diverged after import: expected ${JSON.stringify(
        expVal
      )}, got ${JSON.stringify(actVal)}`;
    }
  }
  return null;
}

/**
 * Verify an `unset` mutation actually stuck — the key must be absent from the
 * post-import re-export.
 */
export function verifyUnsetMutation(vars: Variables, key: string): string | null {
  if (key in vars) {
    return `variable '${key}' still present after unset`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// YAML file IO
// ---------------------------------------------------------------------------

export interface YamlVarsFile {
  doc: yaml.Document.Parsed;
  vars: Variables;
}

/**
 * Parse a YAML file into a `yaml.Document` (preserves comments + ordering)
 * and return the `variables:` map alongside.
 *
 * Returns an empty map when no `variables:` block is present.
 */
export async function readVarsFromYamlFile(filePath: string): Promise<YamlVarsFile> {
  const content = await fs.readFile(filePath, 'utf-8');
  const doc = yaml.parseDocument(content);
  const parsed = doc.toJS() as { variables?: Variables } | null;
  const vars: Variables = parsed?.variables ?? {};
  return { doc, vars };
}

/**
 * Write a `yaml.Document` back to disk, preserving the formatting captured
 * during parse (comments, key order, quoting style).
 */
export async function writeYamlFile(filePath: string, doc: yaml.Document): Promise<void> {
  await fs.writeFile(filePath, doc.toString(), 'utf-8');
}

// ---------------------------------------------------------------------------
// Target resolution: <file> XOR --id
// ---------------------------------------------------------------------------

export type VarsTarget = { kind: 'file'; path: string } | { kind: 'id'; uuid: string };

/**
 * Resolve the file/id target for a `vars` command. Throws when both or
 * neither are provided, or when `--id` is not a full UUID. Callers exit 1
 * with the thrown message — they are the entry points and own process.exit.
 */
export function resolveVarsTarget(args: { file?: string; id?: string }): VarsTarget {
  const hasFile = typeof args.file === 'string' && args.file.length > 0;
  const hasId = typeof args.id === 'string' && args.id.length > 0;

  if (hasFile && hasId) {
    throw new Error('use file OR --id, not both');
  }
  if (!hasFile && !hasId) {
    throw new Error('missing target: provide a YAML file path or --id <uuid>');
  }
  if (hasId) {
    const id = args.id as string;
    if (!isFullUuid(id)) {
      throw new Error(
        `--id requires a full UUID (use 'qa-use test list --query <name>' to find one)`
      );
    }
    return { kind: 'id', uuid: id };
  }
  return { kind: 'file', path: args.file as string };
}
