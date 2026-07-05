import { z } from 'zod';

type AnySchema = z.ZodTypeAny;
type Def = Record<string, AnySchema>;

// Zod doesn't expose a public API for reading schema internals, so read _zod.def
function def<T>(schema: AnySchema): T {
  return schema._zod.def as unknown as T;
}

function toSnakeCase(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// Remove optional/nullable/default/etc wrappers to get to the actual type
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

function discriminatorValues(option: AnySchema, discriminator: string): unknown[] | undefined {
  const inner = unwrap(option);
  if (def<{ type: string }>(inner).type !== 'object') return undefined;

  const field = def<{ shape: Def }>(inner).shape[discriminator];
  if (!field) return undefined;

  const litDef = def<{ type: string; values?: unknown[] }>(unwrap(field));
  return litDef.type === 'literal' ? litDef.values : undefined;
}

function selectUnionOption(
  options: AnySchema[],
  discriminator: string | undefined,
  data: unknown,
): AnySchema | undefined {
  if (discriminator !== undefined && data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const discValue = (data as Record<string, unknown>)[discriminator];
    const match = options.find((opt) => discriminatorValues(opt, discriminator)?.includes(discValue));
    if (match) return match;
  }

  return options.find((opt) => opt.safeParse(data).success);
}

// snake_case to camelCase, walks nested objects/arrays using the schema shape
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
      // snake_case first, fall back to camelCase
      const value = Object.hasOwn(raw, snakeKey) ? raw[snakeKey] : raw[camelKey];
      result[camelKey] = applyTransform(fieldSchema, value);
    }

    return result;
  }

  if (type === 'union') {
    const { options, discriminator } = def<{ options: AnySchema[]; discriminator?: string }>(inner);
    const option = selectUnionOption(options, discriminator, data);
    return option ? applyTransform(option, data) : data;
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

// Remap keys then validate, main entry point for incoming API responses
export function parseFromApi<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(applyTransform(schema, data));
}

// camelCase to snake_case, skips undefined fields
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

  if (type === 'union') {
    const { options, discriminator } = def<{ options: AnySchema[]; discriminator?: string }>(inner);
    const option = selectUnionOption(options, discriminator, data);
    return option ? applyReverseTransform(option, data) : data;
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

// Main entry point for outgoing request bodies
export function serializeForApi<T extends z.ZodTypeAny>(schema: T, data: z.infer<T>): unknown {
  return applyReverseTransform(schema, data);
}
