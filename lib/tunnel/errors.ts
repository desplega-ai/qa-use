/**
 * Structured tunnel error classes.
 *
 * The CLI uses these to render triage-hint error messages on tunnel
 * failure. `classifyTunnelFailure` inspects a thrown error from the
 * underlying `@desplega.ai/localtunnel` provider and returns the most
 * specific subclass we can identify.
 *
 * Zero retries live in this layer — classification is strictly about
 * picking the right error shape to hand back up the stack.
 */

export interface TunnelErrorContext {
  /** Human-readable target the user was trying to tunnel (URL or host:port). */
  target?: string;
  /** Identifier of the tunnel provider (kept open for future providers). */
  provider?: string;
  /** Original underlying error, preserved for logs / debugging. */
  cause?: unknown;
}

/**
 * Base class for all tunnel-layer failures surfaced to the CLI.
 *
 * Do not throw `TunnelError` directly — throw one of the subclasses
 * below so the CLI can pick the right hint.
 */
export class TunnelError extends Error {
  readonly target?: string;
  readonly provider?: string;
  readonly cause?: unknown;

  constructor(message: string, context: TunnelErrorContext = {}) {
    super(message);
    this.name = 'TunnelError';
    this.target = context.target;
    this.provider = context.provider ?? 'localtunnel';
    this.cause = context.cause;
  }
}

/** Network / connectivity failure (DNS, timeout, ECONNREFUSED, etc.). */
export class TunnelNetworkError extends TunnelError {
  constructor(message: string, context: TunnelErrorContext = {}) {
    super(message, context);
    this.name = 'TunnelNetworkError';
  }
}

/** Auth failure (bad/expired API key, 401/403 from provider). */
export class TunnelAuthError extends TunnelError {
  constructor(message: string, context: TunnelErrorContext = {}) {
    super(message, context);
    this.name = 'TunnelAuthError';
  }
}

/** Quota / rate-limit / subdomain-clash failure. */
export class TunnelQuotaError extends TunnelError {
  constructor(message: string, context: TunnelErrorContext = {}) {
    super(message, context);
    this.name = 'TunnelQuotaError';
  }
}

/** Fallback when no classification matched. */
export class TunnelUnknownError extends TunnelError {
  constructor(message: string, context: TunnelErrorContext = {}) {
    super(message, context);
    this.name = 'TunnelUnknownError';
  }
}

function extractStatusCode(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const obj = err as Record<string, unknown>;
  if (typeof obj.statusCode === 'number') return obj.statusCode;
  if (typeof obj.status === 'number') return obj.status;
  // Some providers nest the status in a `response` object.
  const response = obj.response;
  if (response && typeof response === 'object') {
    const respObj = response as Record<string, unknown>;
    if (typeof respObj.status === 'number') return respObj.status;
    if (typeof respObj.statusCode === 'number') return respObj.statusCode;
  }
  return undefined;
}

function extractErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const obj = err as Record<string, unknown>;
  if (typeof obj.code === 'string') return obj.code;
  return undefined;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
  }
  try {
    return String(err);
  } catch {
    return 'unknown tunnel error';
  }
}

const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

/**
 * Inspect a thrown tunnel error and return the most specific
 * `TunnelError` subclass we can identify.
 *
 * Heuristics:
 *   - Node / undici error codes (`ECONNREFUSED`, `ETIMEDOUT`, …) →
 *     `TunnelNetworkError`
 *   - HTTP 401/403 → `TunnelAuthError`
 *   - HTTP 429 or messages about quota / rate-limit / subdomain in use →
 *     `TunnelQuotaError`
 *   - Everything else → `TunnelUnknownError`
 */
export function classifyTunnelFailure(err: unknown, context: TunnelErrorContext = {}): TunnelError {
  const ctx: TunnelErrorContext = {
    ...context,
    cause: context.cause ?? err,
  };
  const message = extractMessage(err);
  const code = extractErrorCode(err);
  const status = extractStatusCode(err);
  const lowered = message.toLowerCase();

  if (code && NETWORK_CODES.has(code)) {
    return new TunnelNetworkError(message, ctx);
  }

  if (/timeout|timed out|econnrefused|econnreset|enotfound|network/i.test(lowered)) {
    return new TunnelNetworkError(message, ctx);
  }

  if (
    status === 401 ||
    status === 403 ||
    /\b(401|403|unauthori[sz]ed|forbidden)\b/i.test(lowered)
  ) {
    return new TunnelAuthError(message, ctx);
  }

  if (
    status === 429 ||
    /quota|rate.?limit|too many|subdomain.*(in use|taken|already)/i.test(lowered)
  ) {
    return new TunnelQuotaError(message, ctx);
  }

  return new TunnelUnknownError(message || 'tunnel failed', ctx);
}
