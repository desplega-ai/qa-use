import { Command } from 'commander';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, warning } from '../../lib/output.js';
import { loadOpenApiSpec, type OpenApiRefreshMode } from './lib/openapi-spec.js';
import { renderRouteInfo } from './lib/output.js';
import { resolveOperationCandidates } from './lib/route-matching.js';

interface InfoOptions {
  method?: string;
  json?: boolean;
  refresh?: boolean;
  offline?: boolean;
}

function getRefreshMode(options: InfoOptions): OpenApiRefreshMode {
  if (options.refresh && options.offline) {
    throw new Error('Cannot use --refresh and --offline together');
  }
  if (options.refresh) return 'refresh';
  if (options.offline) return 'offline';
  return 'default';
}

export const infoCommand = new Command('info')
  .description('Show detailed info for an API route (input/output types)')
  .argument('<route>', 'API route path, e.g. /api/v1/tests')
  .option('-X, --method <method>', 'Filter by HTTP method (GET, POST, PUT, PATCH, DELETE)')
  .option('--json', 'Output as JSON')
  .option('--refresh', 'Force refresh OpenAPI spec from server')
  .option('--offline', 'Use cached OpenAPI spec only')
  .action(async (route: string, options: InfoOptions) => {
    try {
      const config = await loadConfig();
      const apiUrl = config.api_url || process.env.QA_USE_API_URL || 'https://api.desplega.ai';
      const apiKey = config.api_key || process.env.QA_USE_API_KEY;
      const refreshMode = getRefreshMode(options);

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

      let candidates = resolveOperationCandidates(route, openApi.index.operations);

      if (options.method) {
        const expectedMethod = options.method.toUpperCase();
        candidates = candidates.filter((op) => op.method === expectedMethod);
      }

      if (candidates.length === 0) {
        const methodHint = options.method ? ` with method ${options.method.toUpperCase()}` : '';
        console.log(error(`No operations found for ${route}${methodHint}`));
        console.log('Use `qa-use api ls` to list available endpoints.');
        process.exit(1);
      }

      console.log(renderRouteInfo(candidates, { json: options.json }));
    } catch (err) {
      console.error(error(`Failed to get route info: ${formatError(err)}`));
      process.exit(1);
    }
  });
