export interface OpenApiSchemaRef {
  $ref?: string;
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, OpenApiSchemaRef>;
  items?: OpenApiSchemaRef;
  required?: string[];
  anyOf?: OpenApiSchemaRef[];
  allOf?: OpenApiSchemaRef[];
  oneOf?: OpenApiSchemaRef[];
  additionalProperties?: boolean | OpenApiSchemaRef;
  enum?: unknown[];
  format?: string;
  default?: unknown;
}

export interface ResolvedSchemaProperty {
  type: string;
  required: boolean;
  description?: string;
}

export interface ResolvedSchema {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, ResolvedSchemaProperty>;
}

function extractRefName(ref: string): string {
  const parts = ref.split('/');
  return parts[parts.length - 1];
}

export function formatSchemaType(schema: OpenApiSchemaRef | undefined): string {
  if (!schema) {
    return 'unknown';
  }

  if (schema.$ref) {
    return extractRefName(schema.$ref);
  }

  if (schema.anyOf) {
    const types = schema.anyOf.map((s) => formatSchemaType(s));
    return types.join(' | ');
  }

  if (schema.oneOf) {
    const types = schema.oneOf.map((s) => formatSchemaType(s));
    return types.join(' | ');
  }

  if (schema.allOf) {
    const types = schema.allOf.map((s) => formatSchemaType(s));
    return types.join(' & ');
  }

  if (schema.type === 'array') {
    const itemType = schema.items ? formatSchemaType(schema.items) : 'unknown';
    return `array<${itemType}>`;
  }

  if (schema.type) {
    return schema.type;
  }

  return 'unknown';
}

function lookupRef(
  ref: string,
  componentSchemas: Record<string, OpenApiSchemaRef>
): OpenApiSchemaRef | undefined {
  const name = extractRefName(ref);
  return componentSchemas[name];
}

export function resolveSchemaRef(
  schema: OpenApiSchemaRef | undefined,
  componentSchemas: Record<string, OpenApiSchemaRef> = {}
): ResolvedSchema | undefined {
  if (!schema) {
    return undefined;
  }

  let resolved = schema;
  if (schema.$ref) {
    const looked = lookupRef(schema.$ref, componentSchemas);
    if (!looked) {
      return { type: extractRefName(schema.$ref), title: extractRefName(schema.$ref) };
    }
    resolved = looked;
  }

  if (resolved.allOf) {
    return mergeAllOf(resolved.allOf, componentSchemas, resolved);
  }

  const result: ResolvedSchema = {
    type: formatSchemaType(resolved),
    title: resolved.title,
    description: resolved.description,
  };

  if (resolved.properties) {
    const requiredSet = new Set(resolved.required || []);
    result.properties = {};
    for (const [name, propSchema] of Object.entries(resolved.properties)) {
      result.properties[name] = {
        type: formatSchemaType(propSchema),
        required: requiredSet.has(name),
        description: propSchema.description,
      };
    }
  }

  return result;
}

function mergeAllOf(
  schemas: OpenApiSchemaRef[],
  componentSchemas: Record<string, OpenApiSchemaRef>,
  parent: OpenApiSchemaRef
): ResolvedSchema {
  const merged: ResolvedSchema = {
    type: 'object',
    title: parent.title,
    description: parent.description,
    properties: {},
  };

  for (const sub of schemas) {
    const resolved = resolveSchemaRef(sub, componentSchemas);
    if (resolved?.properties) {
      Object.assign(merged.properties!, resolved.properties);
    }
    if (!merged.title && resolved?.title) {
      merged.title = resolved.title;
    }
    if (!merged.description && resolved?.description) {
      merged.description = resolved.description;
    }
  }

  return merged;
}
