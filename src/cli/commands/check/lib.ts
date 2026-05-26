import * as fs from 'node:fs/promises';
import { parseResourceInput } from '../../lib/api-helpers.js';
import { info, success } from '../../lib/output.js';

export const CHECK_RETRY_STRATEGIES = ['none', 'simple', 'exponential'] as const;
export const CHECK_TYPES = ['api', 'script'] as const;
export const CHECK_SCHEDULE_FAILURE_STRATEGIES = [
  'stop_on_failure',
  'continue_on_failure',
] as const;

export type CheckRetryStrategy = (typeof CHECK_RETRY_STRATEGIES)[number];
export type CheckType = (typeof CHECK_TYPES)[number];
export type CheckScheduleFailureStrategy = (typeof CHECK_SCHEDULE_FAILURE_STRATEGIES)[number];

export interface CheckInputOptions {
  input?: string;
  field?: string[];
  stdin?: NodeJS.ReadableStream;
  name?: string;
  description?: string;
  appConfig?: string;
  type?: string;
  config?: string;
  validation?: string;
  var?: string[];
  dependsOn?: string[];
  alias?: string;
  retryStrategy?: string;
  maxRetries?: string;
  retryDelaySeconds?: string;
  backoffMultiplier?: string;
  timeoutMs?: string;
  capture?: string[];
}

export interface CheckVariableInput {
  key: string;
  value: string | number;
}

export interface CheckOutputCaptureInput {
  name: string;
  json_path: string;
}

export interface CheckScheduleInputOptions {
  input?: string;
  field?: string[];
  stdin?: NodeJS.ReadableStream;
  name?: string;
  description?: string;
  appConfig?: string;
  check?: string[];
  cron?: string;
  timezone?: string;
  enabled?: boolean;
  disabled?: boolean;
  failureStrategy?: string;
  dependencyCondition?: string;
}

export interface CheckScheduleRunOptions {
  var?: string[];
}

export function collectValues(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonValue(rawValue: string): unknown {
  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

function parseIntegerOption(name: string, value: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`${name} must be an integer`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe integer`);
  }

  return parsed;
}

function parseNumberOption(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }

  return parsed;
}

function requireNonNegative(name: string, value: number): number {
  if (value < 0) {
    throw new Error(`${name} must be greater than or equal to 0`);
  }

  return value;
}

function requirePositive(name: string, value: number): number {
  if (value <= 0) {
    throw new Error(`${name} must be greater than 0`);
  }

  return value;
}

export async function readJsonObjectFile(
  path: string,
  label: string
): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(path, 'utf-8');

  try {
    const parsed = JSON.parse(raw);
    if (isPlainObject(parsed)) {
      return parsed;
    }

    throw new Error(`${label} file must contain a JSON object, got ${typeof parsed}`);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Failed to parse ${label} JSON file: ${path}`);
    }
    throw err;
  }
}

export function parseCheckVariables(entries: string[] | undefined): CheckVariableInput[] {
  return (entries ?? []).map((entry) => {
    const idx = entry.indexOf('=');
    if (idx <= 0) {
      throw new Error(`Invalid variable \`${entry}\`. Expected format key=value`);
    }

    const key = entry.slice(0, idx).trim();
    const rawValue = entry.slice(idx + 1).trim();
    const value = parseJsonValue(rawValue);

    if (!key) {
      throw new Error(`Invalid variable \`${entry}\`. Variable key cannot be empty`);
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(`Invalid variable \`${entry}\`. Variable value must be a string or number`);
    }

    return { key, value };
  });
}

export function parseOutputCaptures(entries: string[] | undefined): CheckOutputCaptureInput[] {
  return (entries ?? []).map((entry) => {
    const idx = entry.indexOf('=');
    if (idx <= 0) {
      throw new Error(`Invalid capture \`${entry}\`. Expected format name=json_path`);
    }

    const name = entry.slice(0, idx).trim();
    const jsonPath = entry.slice(idx + 1).trim();

    if (!name) {
      throw new Error(`Invalid capture \`${entry}\`. Capture name cannot be empty`);
    }
    if (!jsonPath) {
      throw new Error(`Invalid capture \`${entry}\`. Capture json_path cannot be empty`);
    }

    return { name, json_path: jsonPath };
  });
}

export function validateCheckRetryStrategy(value: string): CheckRetryStrategy {
  if (!CHECK_RETRY_STRATEGIES.includes(value as CheckRetryStrategy)) {
    throw new Error(
      `Invalid retry strategy \`${value}\`. Expected one of: ${CHECK_RETRY_STRATEGIES.join(', ')}`
    );
  }

  return value as CheckRetryStrategy;
}

export function validateCheckType(value: string): CheckType {
  if (!CHECK_TYPES.includes(value as CheckType)) {
    throw new Error(`Invalid check type \`${value}\`. Expected one of: ${CHECK_TYPES.join(', ')}`);
  }

  return value as CheckType;
}

export function validateCheckScheduleFailureStrategy(value: string): CheckScheduleFailureStrategy {
  if (!CHECK_SCHEDULE_FAILURE_STRATEGIES.includes(value as CheckScheduleFailureStrategy)) {
    throw new Error(
      `Invalid failure strategy \`${value}\`. Expected one of: ${CHECK_SCHEDULE_FAILURE_STRATEGIES.join(', ')}`
    );
  }

  return value as CheckScheduleFailureStrategy;
}

export function parseJsonObjectOption(name: string, rawValue: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawValue);
    if (isPlainObject(parsed)) {
      return parsed;
    }

    throw new Error(`${name} must be a JSON object`);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Failed to parse ${name} as JSON`);
    }
    throw err;
  }
}

export async function buildCheckInputBody(
  options: CheckInputOptions
): Promise<Record<string, unknown>> {
  const body = await parseResourceInput(options);

  if (options.name !== undefined) body.name = options.name;
  if (options.description !== undefined) body.description = options.description;
  if (options.appConfig !== undefined) body.app_config_id = options.appConfig;
  if (options.type !== undefined) body.check_type = validateCheckType(options.type);
  if (options.config !== undefined)
    body.config = await readJsonObjectFile(options.config, 'config');
  if (options.validation !== undefined) {
    body.validation = await readJsonObjectFile(options.validation, 'validation');
  }
  if (options.var && options.var.length > 0) body.variables = parseCheckVariables(options.var);
  if (options.dependsOn && options.dependsOn.length > 0) {
    body.check_dependency_ids = options.dependsOn;
  }
  if (options.alias !== undefined) body.alias = options.alias;
  if (options.capture && options.capture.length > 0) {
    body.output_captures = parseOutputCaptures(options.capture);
  }
  if (options.retryStrategy !== undefined) {
    body.retry_strategy = validateCheckRetryStrategy(options.retryStrategy);
  }
  if (options.maxRetries !== undefined) {
    body.max_retries = requireNonNegative(
      '--max-retries',
      parseIntegerOption('--max-retries', options.maxRetries)
    );
  }
  if (options.retryDelaySeconds !== undefined) {
    body.retry_delay_seconds = requireNonNegative(
      '--retry-delay-seconds',
      parseNumberOption('--retry-delay-seconds', options.retryDelaySeconds)
    );
  }
  if (options.backoffMultiplier !== undefined) {
    body.backoff_multiplier = requirePositive(
      '--backoff-multiplier',
      parseNumberOption('--backoff-multiplier', options.backoffMultiplier)
    );
  }
  if (options.timeoutMs !== undefined) {
    body.timeout_ms = requirePositive(
      '--timeout-ms',
      parseIntegerOption('--timeout-ms', options.timeoutMs)
    );
  }

  return body;
}

export function validateCheckCreateBody(body: Record<string, unknown>): void {
  const missing: string[] = [];
  if (!body.name) missing.push('name');
  if (!body.app_config_id) missing.push('app_config_id');
  if (!body.config) missing.push('config');

  if (missing.length > 0) {
    throw new Error(
      `Missing required field${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`
    );
  }

  if (!isPlainObject(body.config)) {
    throw new Error('config must be a JSON object');
  }
}

export function validateCheckUpdateBody(body: Record<string, unknown>): void {
  if (Object.keys(body).length === 0) {
    throw new Error('No fields provided');
  }

  if (body.config !== undefined && body.config !== null && !isPlainObject(body.config)) {
    throw new Error('config must be a JSON object');
  }
  if (
    body.validation !== undefined &&
    body.validation !== null &&
    !isPlainObject(body.validation)
  ) {
    throw new Error('validation must be a JSON object');
  }
}

export async function buildCheckScheduleInputBody(
  options: CheckScheduleInputOptions
): Promise<Record<string, unknown>> {
  const body = await parseResourceInput(options);

  if (options.name !== undefined) body.name = options.name;
  if (options.description !== undefined) body.description = options.description;
  if (options.appConfig !== undefined) body.app_config_id = options.appConfig;
  if (options.check && options.check.length > 0) body.check_ids = options.check;
  if (options.cron !== undefined) body.cron_expression = options.cron;
  if (options.timezone !== undefined) body.timezone = options.timezone;
  if (options.enabled && options.disabled) {
    throw new Error('--enabled and --disabled cannot be used together');
  }
  if (options.enabled) body.enabled = true;
  if (options.disabled) body.enabled = false;
  if (options.failureStrategy !== undefined) {
    body.failure_strategy = validateCheckScheduleFailureStrategy(options.failureStrategy);
  }
  if (options.dependencyCondition !== undefined) {
    body.check_dependency_graph_conditions = parseJsonObjectOption(
      '--dependency-condition',
      options.dependencyCondition
    );
  }

  return body;
}

export function validateCheckScheduleCreateBody(body: Record<string, unknown>): void {
  const missing: string[] = [];
  if (!body.name) missing.push('name');
  if (!body.app_config_id) missing.push('app_config_id');
  if (!body.cron_expression) missing.push('cron_expression');

  if (missing.length > 0) {
    throw new Error(
      `Missing required field${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`
    );
  }
}

export function validateCheckScheduleUpdateBody(body: Record<string, unknown>): void {
  if (Object.keys(body).length === 0) {
    throw new Error('No fields provided');
  }
}

export function buildCheckScheduleRunBody(
  scheduleId: string,
  options: CheckScheduleRunOptions
): Record<string, unknown> {
  return {
    schedule_id: scheduleId,
    variables: parseCheckVariables(options.var),
  };
}

function firstStringLikeValue(
  source: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number') return String(value);
  }

  return undefined;
}

export function getCheckScheduleRunId(response: Record<string, unknown>): string | undefined {
  return firstStringLikeValue(response, [
    'check_schedule_run_id',
    'schedule_run_id',
    'run_id',
    'id',
  ]);
}

export function getCheckScheduleRunStatus(response: Record<string, unknown>): string | undefined {
  return firstStringLikeValue(response, ['run_status', 'status']);
}

export function formatCheckScheduleRunResponse(response: Record<string, unknown>): string {
  const runId = getCheckScheduleRunId(response);
  const status = getCheckScheduleRunStatus(response);
  const lines = [
    runId
      ? success(`Check schedule run started (ID: ${runId})`)
      : success('Check schedule run started'),
  ];

  if (status) {
    lines.push(`  Status: ${status}`);
  }

  lines.push(info('Use --json to inspect the raw untyped run response.'));

  return lines.join('\n');
}
