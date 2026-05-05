/**
 * qa-use test vars unset - Remove a typed variable from a test.
 *
 * Local-file path: deletes the key via the yaml.Document API. When the
 * `variables:` map becomes empty, the whole block is removed.
 *
 * Remote `--id` path: export → mutate (delete the key) → import. Absent keys
 * are a no-op on either path (exit 0 with an info note).
 */

import { Command } from 'commander';
import * as yaml from 'yaml';
import type { TestDefinition } from '../../../../types/test-definition.js';
import { createApiClient, loadConfig } from '../../../lib/config.js';
import { error, formatError, info, success } from '../../../lib/output.js';
import {
  readVarsFromYamlFile,
  resolveVarsTarget,
  verifyUnsetMutation,
  writeYamlFile,
} from '../../../lib/test-vars.js';

interface UnsetOptions {
  key?: string;
  id?: string;
}

function fail(msg: string): never {
  console.log(error(msg));
  process.exit(1);
}

export const unsetCommand = new Command('unset')
  .description('Remove a typed variable from a test (local YAML or remote --id)')
  .argument('[file]', 'Path to a local test YAML file')
  .option('--id <uuid>', 'Remote test UUID — exports YAML, mutates, re-imports')
  .requiredOption('--key <key>', 'Variable name')
  .action(async (file: string | undefined, options: UnsetOptions) => {
    try {
      const target = resolveVarsTarget({ file, id: options.id });
      if (!options.key) fail('--key is required');
      const key = options.key as string;

      if (target.kind === 'file') {
        const { doc } = await readVarsFromYamlFile(target.path);

        const exists = doc.hasIn(['variables', key]);
        if (!exists) {
          console.log(info(`key '${key}' not present in ${target.path}`));
          return;
        }

        doc.deleteIn(['variables', key]);

        // If the variables map is now empty, drop the whole block.
        const remaining = doc.getIn(['variables']);
        const isEmpty =
          remaining === null ||
          remaining === undefined ||
          (yaml.isMap(remaining) && remaining.items.length === 0);
        if (isEmpty) {
          doc.deleteIn(['variables']);
        }

        await writeYamlFile(target.path, doc);
        console.log(success(`Unset variable '${key}' in ${target.path}`));
        return;
      }

      // Remote --id path
      const config = await loadConfig();
      const client = createApiClient(config);
      const yamlText = await client.exportTest(target.uuid, 'yaml', false);
      const def = (yaml.parse(yamlText) as TestDefinition | null) ?? ({} as TestDefinition);
      const vars = def.variables ?? {};
      if (!(key in vars)) {
        console.log(info(`key '${key}' not present on test ${target.uuid}`));
        return;
      }
      delete vars[key];
      def.variables = vars;
      const result = await client.importTestDefinition([def]);
      if (result?.success === false) {
        fail(`import failed: ${JSON.stringify(result)}`);
      }
      const action = result?.imported?.[0]?.action;
      if (action === 'conflict') {
        const message = result?.imported?.[0]?.message;
        fail(
          `import returned conflict for test ${target.uuid}${
            message ? `: ${message}` : ''
          } — variable '${key}' was not removed`
        );
      }

      // Re-export and verify the deletion took effect — see set.ts for why
      // `ImportResult.success === true` is not a strong enough signal.
      const reExportText = await client.exportTest(target.uuid, 'yaml', false);
      const reExportDef =
        (yaml.parse(reExportText) as TestDefinition | null) ?? ({} as TestDefinition);
      const verifyError = verifyUnsetMutation(reExportDef.variables ?? {}, key);
      if (verifyError !== null) {
        fail(
          `post-import verification failed: ${verifyError}${
            action ? ` (import action: ${action})` : ''
          }`
        );
      }
      console.log(success(`Unset variable '${key}' on test ${target.uuid}`));
    } catch (err) {
      console.log(error(`Failed to unset variable: ${formatError(err)}`));
      process.exit(1);
    }
  });
