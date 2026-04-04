import * as fs from 'node:fs/promises';
import { Command } from 'commander';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, warning } from '../../lib/output.js';
import { executeApiRequest, formatApiResponseError } from './lib/http.js';
import {
  loadOpenApiSpec,
  type NormalizedOperation,
  type OpenApiRefreshMode,
} from './lib/openapi-spec.js';
import { resolveOperationCandidates } from './lib/route-matching.js';

interface RequestCommandOptions {
  method?: string;
  field?: string[];
  header?: string[];
  input?: string;
  include?: boolean;
  raw?: boolean;
  refresh?: boolean;
  offline?: boolean;
}

interface RequestRegistrationOptions {
  endpointRequired?: boolean;
}

function collectValues(value: string, previous: string[] = []): string[] {
  previous.push(value);
  return previous;
}

function parseKeyValuePairs(entries: string[], separator: '=' | ':'): Record<string, string> {
  const output: Record<string, string> = {};
  for (const entry of entries) {
    const idx = entry.indexOf(separator);
    if (idx <= 0) {
      throw new Error(`Invalid entry \`${entry}\`. Expected format key${separator}value`);
    }
    const key = entry.slice(0, idx).trim();
    const value = entry.slice(idx + 1).trim();
    if (!key) {
      throw new Error(`Invalid entry \`${entry}\`: key cannot be empty`);
    }
    output[key] = value;
  }
  return output;
}

function parseEndpoint(endpoint: string): { path: string; query: Record<string, string> } {
  const parsed = new URL(endpoint, 'https://qa-use.local');
  const query: Record<string, string> = {};
  for (const [key, value] of parsed.searchParams.entries()) {
    query[key] = value;
  }

  return {
    path: parsed.pathname,
    query,
  };
}

export function inferMethod(
  explicitMethod: string | undefined,
  path: string,
  operations: Record<string, NormalizedOperation>
): string {
  if (explicitMethod) {
    return explicitMethod.toUpperCase();
  }

  const candidates = resolveOperationCandidates(path, operations);
  if (candidates.length === 1) {
    return candidates[0].method;
  }

  const hasGet = candidates.find((candidate) => candidate.method === 'GET');
  if (hasGet) {
    return 'GET';
  }

  if (candidates.length > 1) {
    const methods = candidates
      .map((candidate) => candidate.method)
      .sort()
      .join(', ');
    throw new Error(`Multiple operations match ${path}. Specify --method one of: ${methods}`);
  }

  return 'GET';
}

export function resolveOperation(
  path: string,
  method: string,
  operations: Record<string, NormalizedOperation>
): NormalizedOperation | undefined {
  return resolveOperationCandidates(path, operations).find(
    (operation) => operation.method === method
  );
}

function validateFieldType(name: string, value: string, schemaType?: string): void {
  if (!schemaType) {
    return;
  }

  if (schemaType === 'integer' && !Number.isInteger(Number(value))) {
    throw new Error(`Field \`${name}\` must be an integer`);
  }

  if (schemaType === 'number' && Number.isNaN(Number(value))) {
    throw new Error(`Field \`${name}\` must be a number`);
  }

  if (schemaType === 'boolean' && value !== 'true' && value !== 'false') {
    throw new Error(`Field \`${name}\` must be true or false`);
  }
}

async function loadInputBody(path: string): Promise<unknown> {
  const raw = await fs.readFile(path, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse JSON input file: ${path}`);
  }
}

function getRefreshMode(options: RequestCommandOptions): OpenApiRefreshMode {
  if (options.refresh && options.offline) {
    throw new Error('Cannot use --refresh and --offline together');
  }
  if (options.refresh) return 'refresh';
  if (options.offline) return 'offline';
  return 'default';
}

function shouldUseQuery(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'DELETE' || method === 'OPTIONS';
}

export function registerApiRequestAction(
  command: Command,
  registrationOptions: RequestRegistrationOptions = {}
): Command {
  const endpointArgument =
    registrationOptions.endpointRequired === false ? '[endpoint]' : '<endpoint>';

  return command
    .argument(endpointArgument, 'API endpoint path, e.g. /api/v1/tests')
    .option('-X, --method <method>', 'HTTP method (GET, POST, PUT, PATCH, DELETE)')
    .option(
      '-f, --field <key=value>',
      'Add request field (query for GET, body for others)',
      collectValues,
      []
    )
    .option('-H, --header <name:value>', 'Add request header', collectValues, [])
    .option('--input <file>', 'JSON body file path')
    .option('--include', 'Include response status and headers in output')
    .option('--raw', 'Print raw response body')
    .option('--refresh', 'Force refresh OpenAPI spec from server')
    .option('--offline', 'Use cached OpenAPI spec only')
    .action(async (endpoint: string | undefined, options: RequestCommandOptions, cmd: Command) => {
      try {
        if (!endpoint) {
          cmd.help();
          return;
        }

        const config = await loadConfig();
        const apiUrl = config.api_url || process.env.QA_USE_API_URL || 'https://api.desplega.ai';
        const apiKey = config.api_key || process.env.QA_USE_API_KEY;
        const refreshMode = getRefreshMode(options);
        const { path, query: urlQuery } = parseEndpoint(endpoint);
        const fieldMap = parseKeyValuePairs(options.field || [], '=');
        const headerMap: Record<string, string> = {
          ...config.headers,
          ...parseKeyValuePairs(options.header || [], ':'),
        };

        const openApi = await loadOpenApiSpec({
          apiUrl,
          apiKey,
          refreshMode,
          customHeaders: config.headers,
        });

        if (openApi.stale) {
          for (const message of openApi.warnings) {
            console.error(warning(message));
          }
        }

        const method = inferMethod(options.method, path, openApi.index.operations);
        const operation = resolveOperation(path, method, openApi.index.operations);

        if (!operation && !options.method) {
          throw new Error(
            `No OpenAPI operation found for ${path}. Use --method to call unknown endpoints explicitly.`
          );
        }

        const query: Record<string, string> = { ...urlQuery };
        let body: unknown;

        if (options.input) {
          body = await loadInputBody(options.input);
        }

        if (shouldUseQuery(method)) {
          Object.assign(query, fieldMap);
        } else if (Object.keys(fieldMap).length > 0) {
          if (options.input) {
            throw new Error('Cannot combine --input with --field for non-GET methods');
          }
          body = fieldMap;
        }

        if (operation) {
          for (const parameter of operation.parameters) {
            if (parameter.in === 'query') {
              const value = query[parameter.name];
              if (parameter.required && (value === undefined || value === '')) {
                throw new Error(`Missing required query parameter: ${parameter.name}`);
              }
              if (value !== undefined) {
                validateFieldType(parameter.name, value, parameter.schemaType);
              }
            }
          }

          if (operation.requestBodyRequired && body === undefined) {
            throw new Error(`Operation ${method} ${operation.path} requires a request body`);
          }
        }

        const response = await executeApiRequest({
          apiUrl,
          apiKey,
          method,
          path,
          headers: headerMap,
          query,
          body,
        });

        if (options.include) {
          console.log(`HTTP ${response.status} ${response.statusText}`);
          for (const [name, value] of Object.entries(response.headers)) {
            console.log(`${name}: ${value}`);
          }
          console.log('');
        }

        if (response.status >= 400) {
          console.error(
            error(formatApiResponseError(response.status, response.statusText, response.data))
          );
          if (response.data !== undefined) {
            if (typeof response.data === 'string') {
              console.error(response.data);
            } else {
              console.error(JSON.stringify(response.data, null, 2));
            }
          }
          process.exit(1);
        }

        if (options.raw) {
          if (typeof response.data === 'string') {
            console.log(response.data);
          } else {
            console.log(JSON.stringify(response.data));
          }
        } else if (typeof response.data === 'string') {
          console.log(response.data);
        } else {
          console.log(JSON.stringify(response.data, null, 2));
        }
      } catch (err) {
        console.error(error(`API request failed: ${formatError(err)}`));
        process.exit(1);
      }
    });
}

export const requestCommand = registerApiRequestAction(
  new Command('request').description('Send API requests using OpenAPI metadata'),
  { endpointRequired: true }
);
