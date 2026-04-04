import { describe, expect, test } from 'bun:test';
import { formatSchemaType, type OpenApiSchemaRef, resolveSchemaRef } from './schema-resolver.js';

describe('formatSchemaType', () => {
  test('returns type for simple schemas', () => {
    expect(formatSchemaType({ type: 'string' })).toBe('string');
    expect(formatSchemaType({ type: 'integer' })).toBe('integer');
    expect(formatSchemaType({ type: 'boolean' })).toBe('boolean');
    expect(formatSchemaType({ type: 'number' })).toBe('number');
  });

  test('returns ref name for $ref schemas', () => {
    expect(formatSchemaType({ $ref: '#/components/schemas/RunTestsRequest' })).toBe(
      'RunTestsRequest'
    );
  });

  test('formats array types', () => {
    expect(formatSchemaType({ type: 'array', items: { type: 'string' } })).toBe('array<string>');
    expect(
      formatSchemaType({
        type: 'array',
        items: { $ref: '#/components/schemas/TestItem' },
      })
    ).toBe('array<TestItem>');
  });

  test('formats anyOf as union type', () => {
    expect(
      formatSchemaType({
        anyOf: [{ type: 'string' }, { type: 'null' }],
      })
    ).toBe('string | null');
  });

  test('formats oneOf as union type', () => {
    expect(
      formatSchemaType({
        oneOf: [{ type: 'string' }, { type: 'integer' }],
      })
    ).toBe('string | integer');
  });

  test('formats allOf as intersection type', () => {
    expect(
      formatSchemaType({
        allOf: [{ $ref: '#/components/schemas/Base' }, { $ref: '#/components/schemas/Extended' }],
      })
    ).toBe('Base & Extended');
  });

  test('returns unknown for undefined or empty', () => {
    expect(formatSchemaType(undefined)).toBe('unknown');
    expect(formatSchemaType({})).toBe('unknown');
  });
});

describe('resolveSchemaRef', () => {
  const componentSchemas: Record<string, OpenApiSchemaRef> = {
    RunTestsRequest: {
      title: 'RunTestsRequest',
      description: 'Request body for batch running tests',
      type: 'object',
      properties: {
        test_ids: { type: 'array', items: { type: 'string' } },
        app_config_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
      required: ['test_ids'],
    },
    TestItem: {
      title: 'TestItem',
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['id', 'name'],
    },
  };

  test('resolves $ref to component schema', () => {
    const result = resolveSchemaRef(
      { $ref: '#/components/schemas/RunTestsRequest' },
      componentSchemas
    );
    expect(result).toBeDefined();
    expect(result!.title).toBe('RunTestsRequest');
    expect(result!.description).toBe('Request body for batch running tests');
    expect(result!.properties).toBeDefined();
    expect(result!.properties!.test_ids.type).toBe('array<string>');
    expect(result!.properties!.test_ids.required).toBe(true);
    expect(result!.properties!.app_config_id.type).toBe('string | null');
    expect(result!.properties!.app_config_id.required).toBe(false);
  });

  test('resolves inline schema', () => {
    const result = resolveSchemaRef(
      {
        type: 'object',
        properties: {
          count: { type: 'integer', description: 'Total count' },
        },
        required: ['count'],
      },
      componentSchemas
    );
    expect(result).toBeDefined();
    expect(result!.properties!.count.type).toBe('integer');
    expect(result!.properties!.count.required).toBe(true);
    expect(result!.properties!.count.description).toBe('Total count');
  });

  test('handles missing $ref target gracefully', () => {
    const result = resolveSchemaRef({ $ref: '#/components/schemas/NonExistent' }, componentSchemas);
    expect(result).toBeDefined();
    expect(result!.type).toBe('NonExistent');
    expect(result!.title).toBe('NonExistent');
  });

  test('returns undefined for undefined input', () => {
    expect(resolveSchemaRef(undefined, componentSchemas)).toBeUndefined();
  });

  test('resolves nested $ref in properties as type name', () => {
    const result = resolveSchemaRef(
      {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/TestItem' } },
        },
      },
      componentSchemas
    );
    expect(result!.properties!.items.type).toBe('array<TestItem>');
  });

  test('resolves allOf by merging properties', () => {
    const result = resolveSchemaRef(
      {
        allOf: [
          { $ref: '#/components/schemas/RunTestsRequest' },
          {
            type: 'object',
            properties: {
              extra_field: { type: 'boolean' },
            },
            required: ['extra_field'],
          },
        ],
      },
      componentSchemas
    );
    expect(result).toBeDefined();
    expect(result!.properties!.test_ids).toBeDefined();
    expect(result!.properties!.extra_field).toBeDefined();
    expect(result!.properties!.extra_field.type).toBe('boolean');
    expect(result!.properties!.extra_field.required).toBe(true);
  });
});
