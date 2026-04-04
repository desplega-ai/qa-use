import { Command } from 'commander';
import { loadConfig } from '../../lib/config.js';
import { error, formatError, warning } from '../../lib/output.js';
import { loadOpenApiSpec, type OpenApiRefreshMode } from './lib/openapi-spec.js';

interface OpenApiCommandOptions {
  raw?: boolean;
  refresh?: boolean;
  offline?: boolean;
}

function getRefreshMode(options: OpenApiCommandOptions): OpenApiRefreshMode {
  if (options.refresh && options.offline) {
    throw new Error('Cannot use --refresh and --offline together');
  }
  if (options.refresh) return 'refresh';
  if (options.offline) return 'offline';
  return 'default';
}

export const openapiCommand = new Command('openapi')
  .description('Show OpenAPI spec URL or dump full spec')
  .option('--raw', 'Dump full OpenAPI spec as JSON')
  .option('--refresh', 'Force refresh spec from server')
  .option('--offline', 'Use cached spec only')
  .action(async (options: OpenApiCommandOptions, command: Command) => {
    try {
      const parentOptions = (command.parent?.opts() || {}) as OpenApiCommandOptions;
      const effectiveOptions: OpenApiCommandOptions = {
        ...parentOptions,
        ...options,
      };

      const config = await loadConfig();
      const apiUrl = (
        config.api_url ||
        process.env.QA_USE_API_URL ||
        'https://api.desplega.ai'
      ).replace(/\/$/, '');

      if (!effectiveOptions.raw) {
        console.log(`${apiUrl}/api/v1/openapi.json`);
        return;
      }

      const apiKey = config.api_key || process.env.QA_USE_API_KEY;
      const refreshMode = getRefreshMode(effectiveOptions);
      const spec = await loadOpenApiSpec({
        apiUrl,
        apiKey,
        refreshMode,
        customHeaders: config.headers,
      });

      if (spec.stale) {
        for (const message of spec.warnings) {
          console.error(warning(message));
        }
      }

      console.log(JSON.stringify(spec.index.raw, null, 2));
    } catch (err) {
      console.error(error(`Failed to load OpenAPI spec: ${formatError(err)}`));
      process.exit(1);
    }
  });
