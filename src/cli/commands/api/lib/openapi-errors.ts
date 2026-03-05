export class OpenApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenApiError';
  }
}

export function formatMissingSpecError(apiUrl: string, detail?: string): string {
  const suffix = detail ? `\nReason: ${detail}` : '';
  return `Unable to load OpenAPI spec from ${apiUrl}/api/v1/openapi.json and no cached spec is available.${suffix}\nRun the command again when online or provide credentials with QA_USE_API_KEY.`;
}

export function formatInvalidSpecError(detail: string): string {
  return `OpenAPI spec is invalid: ${detail}`;
}

export function formatStaleCacheWarning(apiUrl: string, fetchedAt: string, reason: string): string {
  return `Warning: using stale cached OpenAPI spec for ${apiUrl} (cached at ${fetchedAt}). Refresh failed: ${reason}`;
}

export function formatOfflineCacheMissError(apiUrl: string): string {
  return `Offline mode requested, but no cached OpenAPI spec exists for ${apiUrl}. Run with --refresh while online first.`;
}
