import { Command } from 'commander';
import { examplesCommand } from './examples.js';
import { infoCommand } from './info.js';
import { lsCommand } from './ls.js';
import { openapiCommand } from './openapi.js';
import { registerApiRequestAction } from './request.js';

export const apiCommand = registerApiRequestAction(
  new Command('api').description('Call desplega.ai API endpoints using OpenAPI metadata'),
  { endpointRequired: false }
);

apiCommand.addCommand(lsCommand);
apiCommand.addCommand(infoCommand);
apiCommand.addCommand(examplesCommand);
apiCommand.addCommand(openapiCommand);

apiCommand.addHelpText(
  'after',
  `
Subcommands:
  ls                     List available API endpoints
  info <route>           Show detailed route info (input/output types)
  examples               Show example use cases
  openapi                Show OpenAPI spec URL (--raw for full JSON)

Quick Start:
  qa-use api ls                              List all endpoints
  qa-use api /api/v1/tests                   GET request
  qa-use api /api/v1/tests -X POST -f id=1   POST with field
  qa-use api info /api/v1/tests              Route details
  qa-use api openapi                         OpenAPI spec URL

  Use "api info <route>" for detailed route input/output types.
`
);
