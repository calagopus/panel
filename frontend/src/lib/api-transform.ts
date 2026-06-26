import { z } from 'zod';

type AnySchema = z.ZodTypeAny;
type Def = Record<string, AnySchema>;

function def<T>(schema: AnySchema): T {
  return schema._zod.def as unknown as T;
}

function toSnakeCase(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function unwrap(schema: AnySchema): AnySchema {
  const { type } = def<{ type: string }>(schema);

  switch (type) {
    case 'optional':
    case 'nullable':
    case 'default':
      return unwrap(def<{ innerType: AnySchema }>(schema).innerType);
    case 'pipe':
      return unwrap(def<{ in: AnySchema }>(schema).in);
    case 'lazy':
      return unwrap(def<{ getter: () => AnySchema }>(schema).getter());
    default:
      return schema;
  }
}

function applyTransform(schema: AnySchema, data: unknown): unknown {
  const inner = unwrap(schema);
  const { type } = def<{ type: string }>(inner);

  if (type === 'object') {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return data;

    const { shape } = def<{ shape: Def }>(inner);
    const raw = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [camelKey, fieldSchema] of Object.entries(shape)) {
      const snakeKey = toSnakeCase(camelKey);
      const value = Object.hasOwn(raw, snakeKey) ? raw[snakeKey] : raw[camelKey];
      result[camelKey] = applyTransform(fieldSchema, value);
    }

    return result;
  }

  if (type === 'array') {
    if (!Array.isArray(data)) return data;
    const { element } = def<{ element: AnySchema }>(inner);
    return data.map((item) => applyTransform(element, item));
  }

  if (type === 'record') {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return data;
    const { valueType } = def<{ valueType: AnySchema }>(inner);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = applyTransform(valueType, value);
    }
    return result;
  }

  return data;
}

export function parseFromApi<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(applyTransform(schema, data));
}

function applyReverseTransform(schema: AnySchema, data: unknown): unknown {
  const inner = unwrap(schema);
  const { type } = def<{ type: string }>(inner);

  if (type === 'object') {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return data;

    const { shape } = def<{ shape: Def }>(inner);
    const raw = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [camelKey, fieldSchema] of Object.entries(shape)) {
      const snakeKey = toSnakeCase(camelKey);
      const value = raw[camelKey];
      if (value !== undefined) {
        result[snakeKey] = applyReverseTransform(fieldSchema, value);
      }
    }

    return result;
  }

  if (type === 'array') {
    if (!Array.isArray(data)) return data;
    const { element } = def<{ element: AnySchema }>(inner);
    return data.map((item) => applyReverseTransform(element, item));
  }

  if (type === 'record') {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return data;
    const { valueType } = def<{ valueType: AnySchema }>(inner);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = applyReverseTransform(valueType, value);
    }
    return result;
  }

  return data;
}

export function serializeForApi<T extends z.ZodTypeAny>(schema: T, data: z.infer<T>): unknown {
  return applyReverseTransform(schema, data);
}
