import { createHash } from 'node:crypto';
import { type CachedOpenApiSpec, readOpenApiCache, writeOpenApiCache } from './openapi-cache.js';
import {
  formatInvalidSpecError,
  formatMissingSpecError,
  formatOfflineCacheMissError,
  formatStaleCacheWarning,
  OpenApiError,
} from './openapi-errors.js';
import { type OpenApiSchemaRef, type ResolvedSchema, resolveSchemaRef } from './schema-resolver.js';

export type OpenApiRefreshMode = 'default' | 'refresh' | 'offline';

interface OpenApiPathOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: Array<{
    name?: string;
    in?: string;
    required?: boolean;
    description?: string;
    schema?: {
      type?: string;
    };
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<
      string,
      {
        schema?: OpenApiSchemaRef;
      }
    >;
  };
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<
        string,
        {
          schema?: OpenApiSchemaRef;
        }
      >;
    }
  >;
}

interface OpenApiSpecDocument {
  openapi: string;
  paths: Record<string, Record<string, OpenApiPathOperation>>;
  components?: {
    securitySchemes?: Record<string, unknown>;
    schemas?: Record<string, OpenApiSchemaRef>;
  };
}

export interface NormalizedResponseSchema {
  description?: string;
  schema?: ResolvedSchema;
}

export interface NormalizedOperation {
  key: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  operationId?: string;
  tags: string[];
  parameters: Array<{
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie' | 'unknown';
    required: boolean;
    description?: string;
    schemaType?: string;
  }>;
  parameterCount: number;
  requestBodyRequired: boolean;
  requestBodySchema?: ResolvedSchema;
  responseSchemas?: Record<string, NormalizedResponseSchema>;
}

export interface OpenApiSpecIndex {
  raw: OpenApiSpecDocument;
  operations: Record<string, NormalizedOperation>;
}

export interface LoadedOpenApiSpec {
  source: 'live' | 'cache';
  stale: boolean;
  apiUrl: string;
  fetchedAt: string;
  etag?: string;
  specHash: string;
  index: OpenApiSpecIndex;
  warnings: string[];
}

export interface LoadOpenApiSpecOptions {
  apiUrl: string;
  apiKey?: string;
  refreshMode?: OpenApiRefreshMode;
  customHeaders?: Record<string, string>;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);

function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.replace(/\/$/, '');
}

function buildOpenApiUrl(apiUrl: string): string {
  return `${normalizeApiUrl(apiUrl)}/api/v1/openapi.json`;
}

function computeSpecHash(spec: unknown): string {
  return createHash('sha256').update(JSON.stringify(spec)).digest('hex');
}

function validateOpenApiDocument(spec: unknown): OpenApiSpecDocument {
  if (!spec || typeof spec !== 'object') {
    throw new OpenApiError(formatInvalidSpecError('expected an object payload'));
  }

  const candidate = spec as Partial<OpenApiSpecDocument>;

  if (!candidate.openapi || typeof candidate.openapi !== 'string') {
    throw new OpenApiError(formatInvalidSpecError('missing `openapi` version string'));
  }

  if (!candidate.paths || typeof candidate.paths !== 'object' || Array.isArray(candidate.paths)) {
    throw new OpenApiError(formatInvalidSpecError('missing `paths` object'));
  }

  if (
    candidate.components &&
    candidate.components.securitySchemes !== undefined &&
    (typeof candidate.components.securitySchemes !== 'object' ||
      Array.isArray(candidate.components.securitySchemes))
  ) {
    throw new OpenApiError(
      formatInvalidSpecError('`components.securitySchemes` must be an object')
    );
  }

  return candidate as OpenApiSpecDocument;
}

function resolveRequestBodySchema(
  op: OpenApiPathOperation,
  componentSchemas: Record<string, OpenApiSchemaRef>
): ResolvedSchema | undefined {
  const content = op.requestBody?.content;
  if (!content) return undefined;
  const jsonContent = content['application/json'];
  if (!jsonContent?.schema) return undefined;
  return resolveSchemaRef(jsonContent.schema, componentSchemas);
}

function resolveResponseSchemas(
  op: OpenApiPathOperation,
  componentSchemas: Record<string, OpenApiSchemaRef>
): Record<string, NormalizedResponseSchema> | undefined {
  if (!op.responses) return undefined;
  const result: Record<string, NormalizedResponseSchema> = {};
  for (const [statusCode, response] of Object.entries(op.responses)) {
    const jsonContent = response.content?.['application/json'];
    result[statusCode] = {
      description: response.description,
      schema: jsonContent?.schema
        ? resolveSchemaRef(jsonContent.schema, componentSchemas)
        : undefined,
    };
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeOperations(spec: OpenApiSpecDocument): Record<string, NormalizedOperation> {
  const operations: Record<string, NormalizedOperation> = {};
  const componentSchemas = spec.components?.schemas || {};

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      const normalizedMethod = method.toLowerCase();
      if (!HTTP_METHODS.has(normalizedMethod)) {
        continue;
      }

      const op = operation || {};
      const key = `${normalizedMethod.toUpperCase()} ${path}`;
      operations[key] = {
        key,
        method: normalizedMethod.toUpperCase(),
        path,
        summary: op.summary,
        description: op.description,
        operationId: op.operationId,
        tags: Array.isArray(op.tags) ? op.tags.filter((tag) => typeof tag === 'string') : [],
        parameters: Array.isArray(op.parameters)
          ? op.parameters
              .filter((parameter) => Boolean(parameter?.name))
              .map((parameter) => ({
                name: String(parameter.name),
                in:
                  parameter.in === 'path' ||
                  parameter.in === 'query' ||
                  parameter.in === 'header' ||
                  parameter.in === 'cookie'
                    ? parameter.in
                    : 'unknown',
                required: Boolean(parameter.required),
                description: parameter.description,
                schemaType: parameter.schema?.type,
              }))
          : [],
        parameterCount: Array.isArray(op.parameters) ? op.parameters.length : 0,
        requestBodyRequired: Boolean(op.requestBody?.required),
        requestBodySchema: resolveRequestBodySchema(op, componentSchemas),
        responseSchemas: resolveResponseSchemas(op, componentSchemas),
      };
    }
  }

  return operations;
}

function createIndex(spec: OpenApiSpecDocument): OpenApiSpecIndex {
  return {
    raw: spec,
    operations: normalizeOperations(spec),
  };
}

function fromCache(cache: CachedOpenApiSpec, stale: boolean, warning?: string): LoadedOpenApiSpec {
  const spec = validateOpenApiDocument(cache.spec);
  return {
    source: 'cache',
    stale,
    apiUrl: cache.apiUrl,
    fetchedAt: cache.fetchedAt,
    etag: cache.etag,
    specHash: cache.specHash,
    index: createIndex(spec),
    warnings: warning ? [warning] : [],
  };
}

export async function loadOpenApiSpec(options: LoadOpenApiSpecOptions): Promise<LoadedOpenApiSpec> {
  const apiUrl = normalizeApiUrl(options.apiUrl);
  const refreshMode = options.refreshMode || 'default';
  const cache = readOpenApiCache(apiUrl);

  if (refreshMode === 'offline') {
    if (!cache) {
      throw new OpenApiError(formatOfflineCacheMissError(apiUrl));
    }
    return fromCache(cache, false);
  }

  const headers: Record<string, string> = {
    ...options.customHeaders,
  };
  if (options.apiKey) {
    headers.Authorization = `Bearer ${options.apiKey}`;
  }
  if (refreshMode !== 'refresh' && cache?.etag) {
    headers['If-None-Match'] = cache.etag;
  }

  let response: Response;

  try {
    response = await fetch(buildOpenApiUrl(apiUrl), {
      method: 'GET',
      headers,
    });
  } catch (error) {
    if (!cache) {
      throw new OpenApiError(
        formatMissingSpecError(apiUrl, error instanceof Error ? error.message : 'network failure')
      );
    }

    return fromCache(
      cache,
      true,
      formatStaleCacheWarning(
        apiUrl,
        cache.fetchedAt,
        error instanceof Error ? error.message : 'network failure'
      )
    );
  }

  if (response.status === 304) {
    if (!cache) {
      throw new OpenApiError(formatMissingSpecError(apiUrl, 'received 304 without cached spec'));
    }
    return fromCache(cache, false);
  }

  if (!response.ok) {
    const reason = `HTTP ${response.status}`;
    if (!cache) {
      throw new OpenApiError(formatMissingSpecError(apiUrl, reason));
    }
    return fromCache(cache, true, formatStaleCacheWarning(apiUrl, cache.fetchedAt, reason));
  }

  let jsonPayload: unknown;
  try {
    jsonPayload = await response.json();
  } catch {
    throw new OpenApiError(formatInvalidSpecError('response body is not valid JSON'));
  }

  const spec = validateOpenApiDocument(jsonPayload);
  const specHash = computeSpecHash(spec);
  const fetchedAt = new Date().toISOString();
  const etag = response.headers.get('etag') ?? undefined;

  writeOpenApiCache({
    apiUrl,
    fetchedAt,
    etag,
    specHash,
    spec,
  });

  return {
    source: 'live',
    stale: false,
    apiUrl,
    fetchedAt,
    etag,
    specHash,
    index: createIndex(spec),
    warnings: [],
  };
}
