/**
 * qa-use test vars unset - Remove a typed variable from a test (local YAML).
 *
 * If the key is absent, exits 0 with an info note (no mutation).
 * When the last key is removed, the `variables:` block is dropped entirely.
 */

import { Command } from 'commander';
import * as yaml from 'yaml';
import { error, formatError, info, success } from '../../../lib/output.js';
import { readVarsFromYamlFile, writeYamlFile } from '../../../lib/test-vars.js';

interface UnsetOptions {
  key?: string;
}

function fail(msg: string): never {
  console.log(error(msg));
  process.exit(1);
}

export const unsetCommand = new Command('unset')
  .description('Remove a typed variable from a test (local YAML)')
  .argument('[file]', 'Path to a local test YAML file')
  .requiredOption('--key <key>', 'Variable name')
  .action(async (file: string | undefined, options: UnsetOptions) => {
    try {
      if (!file) {
        fail(
          'Missing target. Provide a YAML file path.\n  Usage: qa-use test vars unset <file> --key <k>'
        );
      }
      if (!options.key) fail('--key is required');

      const { doc } = await readVarsFromYamlFile(file as string);

      const exists = doc.hasIn(['variables', options.key]);
      if (!exists) {
        console.log(info(`key '${options.key}' not present in ${file}`));
        return;
      }

      doc.deleteIn(['variables', options.key]);

      // If the variables map is now empty, drop the whole block so the file
      // doesn't carry a dangling `variables: {}`. yaml v2 returns YAMLMap for
      // collections, so we measure with `.items.length` rather than Object.keys.
      const remaining = doc.getIn(['variables']);
      const isEmpty =
        remaining === null ||
        remaining === undefined ||
        (yaml.isMap(remaining) && remaining.items.length === 0);
      if (isEmpty) {
        doc.deleteIn(['variables']);
      }

      await writeYamlFile(file as string, doc);
      console.log(success(`Unset variable '${options.key}' in ${file}`));
    } catch (err) {
      console.log(error(`Failed to unset variable: ${formatError(err)}`));
      process.exit(1);
    }
  });
