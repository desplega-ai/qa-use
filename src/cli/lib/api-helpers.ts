/**
 * Shared API request helpers for CLI commands.
 *
 * Config-aware wrapper around executeApiRequest (from api/lib/http.ts)
 * so individual CLI commands don't repeat boilerplate.
 */

import * as fs from 'node:fs/promises';
import * as readline from 'node:readline/promises';
import { executeApiRequest, formatApiResponseError } from '../commands/api/lib/http.js';
import type { CliConfig } from './config.js';

// ---------------------------------------------------------------------------
// requireApiKey
// ---------------------------------------------------------------------------

/**
 * Validates that the config contains an API key.
 * Exits the process with a helpful message when missing.
 */
export function requireApiKey(
  config: CliConfig
): asserts config is CliConfig & { api_key: string } {
  if (!config.api_key) {
    console.log('\x1b[31m✗\x1b[0m API key not configured');
    console.log('  Run `qa-use setup` to configure');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// apiCall
// ---------------------------------------------------------------------------

export interface ApiCallOptions {
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Makes an authenticated API request using the CLI config.
 * Throws on HTTP errors (status >= 400) with a human-readable message.
 */
export async function apiCall(
  config: CliConfig,
  method: string,
  path: string,
  options: ApiCallOptions = {}
): Promise<unknown> {
  requireApiKey(config);

  const apiUrl = config.api_url || 'https://api.desplega.ai';

  const response = await executeApiRequest({
    apiUrl,
    apiKey: config.api_key,
    method,
    path,
    headers: { ...config.headers, ...options.headers },
    query: options.query,
    body: options.body,
  });

  if (response.status >= 400) {
    throw new Error(formatApiResponseError(response.status, response.statusText, response.data));
  }

  return response.data;
}

// ---------------------------------------------------------------------------
// paginationQuery
// ---------------------------------------------------------------------------

/**
 * Builds pagination query params from common CLI options.
 * Only includes keys whose values are defined.
 */
export function paginationQuery(options: {
  limit?: string;
  offset?: string;
}): Record<string, string> {
  const query: Record<string, string> = {};
  if (options.limit !== undefined) query.limit = options.limit;
  if (options.offset !== undefined) query.offset = options.offset;
  return query;
}

// ---------------------------------------------------------------------------
// collectFields
// ---------------------------------------------------------------------------

/**
 * Collector for Commander's repeatable `-F`/`--field` option.
 *
 * Usage with Commander:
 * ```
 * .option('-F, --field <key=value>', 'Set field', collectFields, [])
 * ```
 */
export function collectFields(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

// ---------------------------------------------------------------------------
// parseResourceInput
// ---------------------------------------------------------------------------

/**
 * Reads body from `--input` file and/or `-F` fields and merges them.
 * Values that parse as valid JSON are treated as JSON
 * (e.g. `-F test_ids='["id1","id2"]'`).
 *
 * Stdin (piped) is intentionally **not** read here — that would complicate
 * interactive commands. Add it later if needed.
 */
export async function parseResourceInput(options: {
  input?: string;
  field?: string[];
}): Promise<Record<string, unknown>> {
  let base: Record<string, unknown> = {};

  // 1. --input file
  if (options.input) {
    const raw = await fs.readFile(options.input, 'utf-8');
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>;
      } else {
        throw new Error(`Input file must contain a JSON object, got ${typeof parsed}`);
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(`Failed to parse JSON input file: ${options.input}`);
      }
      throw err;
    }
  }

  // 2. -F fields (override --input values)
  if (options.field) {
    for (const entry of options.field) {
      const idx = entry.indexOf('=');
      if (idx <= 0) {
        throw new Error(`Invalid field \`${entry}\`. Expected format key=value`);
      }
      const key = entry.slice(0, idx).trim();
      const rawValue = entry.slice(idx + 1).trim();

      // Try to parse as JSON (arrays, objects, numbers, booleans)
      let value: unknown = rawValue;
      try {
        value = JSON.parse(rawValue);
      } catch {
        // Not valid JSON — keep as string
      }

      base[key] = value;
    }
  }

  return base;
}

// ---------------------------------------------------------------------------
// confirmAction
// ---------------------------------------------------------------------------

/**
 * Confirmation prompt for destructive operations.
 * Returns `true` when the user types y/yes (case-insensitive).
 */
export async function confirmAction(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  try {
    const answer = await rl.question(`${message} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
