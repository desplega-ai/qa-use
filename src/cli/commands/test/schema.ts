/**
 * qa-use test schema - View test definition schema
 */

import { Command } from 'commander';
import { createApiClient, loadConfig } from '../../lib/config.js';
import { error, formatError, info } from '../../lib/output.js';

type SchemaNode = Record<string, unknown>;

function formatType(prop: SchemaNode): string {
  if (prop.type === 'array') {
    const items = (prop.items ?? {}) as SchemaNode;
    const inner = formatType(items);
    return inner.includes(' | ') ? `(${inner})[]` : `${inner}[]`;
  }
  if (typeof prop.$ref === 'string') {
    return prop.$ref.split('/').pop() ?? 'object';
  }
  const union = (prop.oneOf ?? prop.anyOf) as SchemaNode[] | undefined;
  if (Array.isArray(union)) {
    return union.map((u) => formatType(u)).join(' | ');
  }
  if (typeof prop.type === 'string') return prop.type;
  return 'unknown';
}

function firstSentence(desc: unknown): string {
  if (typeof desc !== 'string') return '';
  const trimmed = desc.trim();
  const dot = trimmed.indexOf('. ');
  const newline = trimmed.indexOf('\n');
  const cuts = [dot >= 0 ? dot + 1 : -1, newline].filter((n) => n >= 0);
  if (cuts.length === 0) return trimmed;
  return trimmed.slice(0, Math.min(...cuts)).trim();
}

function printSummary(node: SchemaNode): boolean {
  const properties = node.properties as Record<string, SchemaNode> | undefined;
  if (!properties || typeof properties !== 'object') return false;
  const required = new Set((node.required as string[] | undefined) ?? []);
  for (const [name, prop] of Object.entries(properties)) {
    const type = formatType(prop);
    const req = required.has(name) ? ' (required)' : '';
    const desc = firstSentence(prop.description);
    const descPart = desc ? ` — ${desc}` : '';
    console.log(`${name}: ${type}${req}${descPart}`);
  }
  return true;
}

export const schemaCommand = new Command('schema')
  .description('View test definition schema')
  .argument(
    '[path]',
    'JSON path to specific schema part (e.g., "SimpleStep.action", "$defs.ActionInstruction")'
  )
  .addHelpText(
    'after',
    `
Examples:
  qa-use test schema                     # Full schema
  qa-use test schema --summary           # Flat field list (LLM-friendly, no $defs)
  qa-use test schema SimpleStep          # SimpleStep definition
  qa-use test schema SimpleStep.action   # Valid simple actions
  qa-use test schema --raw | jq '.properties.steps'  # Use jq for advanced queries
`
  )
  .option('--raw', 'Output raw JSON without formatting')
  .option('--summary', 'Print a flat field list (no JSON Schema, no $defs/$ref)')
  .action(async (schemaPath, options) => {
    try {
      const config = await loadConfig();

      // Initialize API client
      const client = createApiClient(config);

      // Fetch schema
      const schema = await client.getTestDefinitionSchema();

      let output: unknown = schema;

      // Navigate to specific path if provided
      if (schemaPath) {
        const parts = schemaPath.split('.');
        for (const part of parts) {
          if (output && typeof output === 'object') {
            const obj = output as Record<string, unknown>;
            // Handle $defs references
            if (part === '$defs' || part in obj) {
              output = obj[part];
            } else if (
              obj.$defs &&
              typeof obj.$defs === 'object' &&
              part in (obj.$defs as object)
            ) {
              output = (obj.$defs as Record<string, unknown>)[part];
            } else if (
              obj.properties &&
              typeof obj.properties === 'object' &&
              part in (obj.properties as object)
            ) {
              output = (obj.properties as Record<string, unknown>)[part];
            } else {
              console.log(error(`Path "${schemaPath}" not found in schema`));
              console.log(info(`Available keys: ${Object.keys(obj).join(', ')}`));
              process.exit(1);
            }
          }
        }
      }

      // Output
      if (options.summary) {
        if (output && typeof output === 'object' && printSummary(output as SchemaNode)) {
          return;
        }
        console.log(
          error('--summary requires an object with `properties` (root schema, or a $defs entry)')
        );
        process.exit(1);
      }

      if (options.raw) {
        console.log(JSON.stringify(output));
      } else {
        console.log(JSON.stringify(output, null, 2));

        // If output contains a $ref, suggest follow-up command
        if (
          output &&
          typeof output === 'object' &&
          '$ref' in output &&
          typeof (output as Record<string, unknown>).$ref === 'string'
        ) {
          const ref = (output as Record<string, unknown>).$ref as string;
          // Parse "#/$defs/ActionInstruction" -> "$defs.ActionInstruction"
          const refPath = ref.replace(/^#\//, '').replace(/\//g, '.');
          console.log(info(`\nThis is a reference. To resolve it, run:`));
          console.log(`  qa-use test schema ${refPath}`);
        }
      }
    } catch (err) {
      console.log(error(`Failed to fetch schema: ${formatError(err)}`));
      process.exit(1);
    }
  });
