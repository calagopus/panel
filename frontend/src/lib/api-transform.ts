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

// camelCase conversion mirrors the backend's snake_case keys. camel->snake is lossy around
// digits (`login_bypass_2fa` and `login_bypass2fa` both camelize to `loginBypass2fa`), so
// incoming responses are matched by camelizing the raw keys rather than snake-casing schema keys.
function toCamelCase(key: string): string {
  return key.replace(/_([a-z0-9])/gi, (_, letter: string) => letter.toUpperCase());
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

    // Index raw keys by their camelCase form - the authoritative direction, since schema
    // keys are the camelCase of the backend's snake_case keys
    const byCamel: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      byCamel[toCamelCase(key)] = raw[key];
    }

    const result: Record<string, unknown> = {};
    for (const [camelKey, fieldSchema] of Object.entries(shape)) {
      const value = Object.hasOwn(byCamel, camelKey) ? byCamel[camelKey] : raw[camelKey];
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

function valueAtPath(data: unknown, path: PropertyKey[]): unknown {
  let current: unknown = data;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

// Zod schemas carry no name at runtime, so surface the top-level keys the schema
// expected (helps recognize which schema it is) - undefined if not an object schema
function expectedKeys(schema: AnySchema): string[] | undefined {
  try {
    const inner = unwrap(schema);
    if (def<{ type: string }>(inner).type === 'object') {
      return Object.keys(def<{ shape: Def }>(inner).shape);
    }
  } catch {
    // ignore - best-effort diagnostics only
  }
  return undefined;
}

// First stack frame outside this module: the api/*.ts file that called parseFromApi,
// which is where the failing schema is imported/used
function callerLocation(): string | undefined {
  return new Error().stack
    ?.split('\n')
    .slice(1)
    .find((line) => !line.includes('api-transform'))
    ?.trim();
}

// Human-readable summary of a failed response validation, one line per bad field
function formatSchemaError(schema: AnySchema, error: z.ZodError, data: unknown): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(root)';
    return `  • ${path}: ${issue.message} [got: ${JSON.stringify(valueAtPath(data, issue.path))}]`;
  });

  const keys = expectedKeys(schema);
  const caller = callerLocation();

  return [
    '[api-transform] response failed schema validation:',
    ...lines,
    keys ? `  schema expected keys: ${keys.join(', ')}` : undefined,
    caller ? `  called from: ${caller}` : undefined,
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

// Remap keys then validate, main entry point for incoming API responses
export function parseFromApi<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const transformed = applyTransform(schema, data);
  const result = schema.safeParse(transformed);
  if (!result.success) {
    // Surface schema/backend mismatches loudly - callers often swallow the throw
    console.error(formatSchemaError(schema, result.error, transformed), '\nfull response:', data);
    throw result.error;
  }
  return result.data;
}

// Parse a raw paginated API response, running each entry through parseFromApi
export function parsePaginationFromApi<T extends z.ZodTypeAny>(
  schema: T,
  raw: { total: number; per_page: number; page: number; data?: unknown[] },
): Pagination<z.infer<T>> {
  return {
    total: raw.total,
    perPage: raw.per_page,
    page: raw.page,
    data: (raw.data || []).map((item) => parseFromApi(schema, item)),
  };
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
