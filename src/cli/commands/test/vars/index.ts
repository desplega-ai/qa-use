/**
 * qa-use test vars - Manage typed variables on a test.
 *
 * Subgroup nested under `qa-use test`. Local YAML files are the primary
 * surface; `--id <uuid>` falls back to read-modify-write against the backend
 * via `client.exportTest` + `client.importTestDefinition`.
 */

import { Command } from 'commander';
import { listCommand } from './list.js';

export const varsCommand = new Command('vars').description(
  'Manage typed variables on a test (list/set/unset)'
);

varsCommand.addCommand(listCommand);
