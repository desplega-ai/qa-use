import type { NormalizedOperation, NormalizedResponseSchema } from './openapi-spec.js';
import type { ResolvedSchema } from './schema-resolver.js';

export interface RenderListOptions {
  source: 'live' | 'cache';
  stale: boolean;
  json?: boolean;
}

function pad(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }
  return `${value}${' '.repeat(width - value.length)}`;
}

export function renderOperationList(
  operations: NormalizedOperation[],
  options: RenderListOptions
): string {
  if (options.json) {
    return JSON.stringify(
      {
        source: options.source,
        stale: options.stale,
        count: operations.length,
        operations,
      },
      null,
      2
    );
  }

  if (operations.length === 0) {
    return `No API operations matched your filters.\nSource: ${options.source}${options.stale ? ' (stale cache)' : ''}`;
  }

  const methodWidth = Math.max(6, ...operations.map((operation) => operation.method.length));
  const pathWidth = Math.max(20, ...operations.map((operation) => operation.path.length));

  const lines = [
    `Source: ${options.source}${options.stale ? ' (stale cache)' : ''}`,
    `${pad('METHOD', methodWidth)}  ${pad('PATH', pathWidth)}  SUMMARY`,
    `${'-'.repeat(methodWidth)}  ${'-'.repeat(pathWidth)}  ${'-'.repeat(32)}`,
  ];

  for (const operation of operations) {
    lines.push(
      `${pad(operation.method, methodWidth)}  ${pad(operation.path, pathWidth)}  ${operation.summary || ''}`
    );
  }

  return lines.join('\n');
}

export interface RenderRouteInfoOptions {
  json?: boolean;
}

function renderSchemaProperties(schema: ResolvedSchema, indent: string): string[] {
  const lines: string[] = [];
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return lines;
  }

  const entries = Object.entries(schema.properties);
  const nameWidth = Math.max(5, ...entries.map(([name]) => name.length));
  const typeWidth = Math.max(4, ...entries.map(([, prop]) => prop.type.length));

  lines.push(`${indent}${pad('FIELD', nameWidth)}  ${pad('TYPE', typeWidth)}  REQUIRED`);
  lines.push(`${indent}${'-'.repeat(nameWidth)}  ${'-'.repeat(typeWidth)}  ${'-'.repeat(8)}`);

  for (const [name, prop] of entries) {
    lines.push(
      `${indent}${pad(name, nameWidth)}  ${pad(prop.type, typeWidth)}  ${prop.required ? 'yes' : 'no'}`
    );
  }
  return lines;
}

function renderResponseSchemas(
  responses: Record<string, NormalizedResponseSchema>,
  indent: string
): string[] {
  const lines: string[] = [];
  const codes = Object.keys(responses).sort();
  for (const code of codes) {
    const resp = responses[code];
    const desc = resp.description ? ` - ${resp.description}` : '';
    lines.push(`${indent}${code}${desc}`);
    if (resp.schema?.title) {
      lines.push(`${indent}  Type: ${resp.schema.title}`);
    } else if (resp.schema?.type) {
      lines.push(`${indent}  Type: ${resp.schema.type}`);
    }
  }
  return lines;
}

function renderSingleRouteInfo(op: NormalizedOperation): string[] {
  const lines: string[] = [];
  const indent = '  ';

  lines.push(`${op.method} ${op.path}`);
  if (op.summary) lines.push(`${indent}Summary:     ${op.summary}`);
  if (op.description) lines.push(`${indent}Description: ${op.description}`);
  if (op.tags.length > 0) lines.push(`${indent}Tags:        ${op.tags.join(', ')}`);
  if (op.operationId) lines.push(`${indent}Operation:   ${op.operationId}`);

  // Parameters
  const params = op.parameters.filter((p) => p.in !== 'header');
  lines.push('');
  lines.push(`${indent}Parameters:`);
  if (params.length === 0) {
    lines.push(`${indent}  (none)`);
  } else {
    const nameW = Math.max(4, ...params.map((p) => p.name.length));
    const typeW = Math.max(4, ...params.map((p) => (p.schemaType || 'string').length));
    for (const p of params) {
      const loc = p.in;
      const req = p.required ? 'required' : 'optional';
      lines.push(
        `${indent}  ${pad(p.name, nameW)}  ${pad(p.schemaType || 'string', typeW)}  (${loc}, ${req})`
      );
    }
  }

  // Request body
  if (op.requestBodySchema) {
    const reqLabel = op.requestBodyRequired ? ' (required)' : ' (optional)';
    lines.push('');
    lines.push(`${indent}Request Body${reqLabel}:`);
    if (op.requestBodySchema.title) {
      lines.push(`${indent}  ${op.requestBodySchema.title}`);
    }
    const propLines = renderSchemaProperties(op.requestBodySchema, `${indent}  `);
    if (propLines.length > 0) {
      lines.push(...propLines);
    }
  }

  // Responses
  if (op.responseSchemas) {
    lines.push('');
    lines.push(`${indent}Responses:`);
    lines.push(...renderResponseSchemas(op.responseSchemas, `${indent}  `));
  }

  return lines;
}

export function renderRouteInfo(
  operations: NormalizedOperation[],
  options: RenderRouteInfoOptions = {}
): string {
  if (options.json) {
    return JSON.stringify(operations.length === 1 ? operations[0] : operations, null, 2);
  }

  if (operations.length === 0) {
    return 'No matching operations found.';
  }

  const sections = operations.map((op) => renderSingleRouteInfo(op));
  return sections.map((lines) => lines.join('\n')).join('\n\n');
}
