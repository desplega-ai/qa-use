import { Command } from 'commander';
import { lsCommand } from './ls.js';
import { registerApiRequestAction } from './request.js';

export const apiCommand = registerApiRequestAction(
  new Command('api').description('Call desplega.ai API endpoints using OpenAPI metadata'),
  { endpointRequired: false }
);

apiCommand.addCommand(lsCommand);
