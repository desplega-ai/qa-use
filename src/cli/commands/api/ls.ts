import { Command } from 'commander';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, warning } from '../../lib/output.js';
import { loadOpenApiSpec, type OpenApiRefreshMode } from './lib/openapi-spec.js';
import { renderOperationList } from './lib/output.js';

interface ListOptions {
  method?: string;
  query?: string;
  tag?: string;
  json?: boolean;
  refresh?: boolean;
  offline?: boolean;
}

function getRefreshMode(options: ListOptions): OpenApiRefreshMode {
  if (options.refresh && options.offline) {
    throw new Error('Cannot use --refresh and --offline together');
  }
  if (options.refresh) return 'refresh';
  if (options.offline) return 'offline';
  return 'default';
}

export const lsCommand = new Command('ls')
  .description('List available /api/v1 endpoints from OpenAPI')
  .option('-X, --method <method>', 'Filter by HTTP method (GET, POST, PUT, PATCH, DELETE)')
  .option('-q, --query <text>', 'Filter by text in path, summary, or operation id')
  .option('--tag <tag>', 'Filter by OpenAPI tag')
  .option('--json', 'Render JSON output')
  .option('--refresh', 'Force refresh OpenAPI spec from server')
  .option('--offline', 'Use cached OpenAPI spec only')
  .action(async (options: ListOptions, command: Command) => {
    try {
      const parentOptions = (command.parent?.opts() || {}) as ListOptions;
      const effectiveOptions: ListOptions = {
        ...parentOptions,
        ...options,
      };

      const config = await loadConfig();
      const apiUrl = config.api_url || process.env.QA_USE_API_URL || 'https://api.desplega.ai';
      const apiKey = config.api_key || process.env.QA_USE_API_KEY;
      const refreshMode = getRefreshMode(effectiveOptions);
      const loadedSpec = await loadOpenApiSpec({ apiUrl, apiKey, refreshMode });

      if (loadedSpec.stale) {
        for (const message of loadedSpec.warnings) {
          console.error(warning(message));
        }
      }

      let operations = Object.values(loadedSpec.index.operations);

      if (effectiveOptions.method) {
        const expectedMethod = effectiveOptions.method.toUpperCase();
        operations = operations.filter((operation) => operation.method === expectedMethod);
      }

      if (effectiveOptions.query) {
        const query = effectiveOptions.query.toLowerCase();
        operations = operations.filter((operation) => {
          return (
            operation.path.toLowerCase().includes(query) ||
            (operation.summary || '').toLowerCase().includes(query) ||
            (operation.operationId || '').toLowerCase().includes(query)
          );
        });
      }

      if (effectiveOptions.tag) {
        const tag = effectiveOptions.tag.toLowerCase();
        operations = operations.filter((operation) =>
          operation.tags.some((operationTag) => operationTag.toLowerCase() === tag)
        );
      }

      operations.sort((a, b) => {
        const pathCompare = a.path.localeCompare(b.path);
        if (pathCompare !== 0) {
          return pathCompare;
        }
        return a.method.localeCompare(b.method);
      });

      console.log(
        renderOperationList(operations, {
          source: loadedSpec.source,
          stale: loadedSpec.stale,
          json: effectiveOptions.json,
        })
      );
    } catch (err) {
      console.error(error(`Failed to list API operations: ${formatError(err)}`));
      process.exit(1);
    }
  });
