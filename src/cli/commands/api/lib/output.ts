import type { NormalizedOperation } from './openapi-spec.js';

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
