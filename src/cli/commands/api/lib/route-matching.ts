import type { NormalizedOperation } from './openapi-spec.js';

export function pathTemplateToRegExp(pathTemplate: string): RegExp {
  const escaped = pathTemplate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\\\{[^/]+\\\}/g, '[^/]+');
  return new RegExp(`^${pattern}$`);
}

export function resolveOperationCandidates(
  path: string,
  operations: Record<string, NormalizedOperation>
): NormalizedOperation[] {
  return Object.values(operations).filter((operation) =>
    pathTemplateToRegExp(operation.path).test(path)
  );
}
