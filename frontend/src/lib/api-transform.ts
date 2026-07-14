import { z } from 'zod';
import type { FormId } from '@/elements/form-engine/types.ts';

type AnySchema = z.ZodTypeAny;
type Def = Record<string, AnySchema>;

// Zod doesn't expose a public API for reading schema internals, so read _zod.def
function def<T>(schema: AnySchema): T {
  return schema._zod.def as unknown as T;
}

const snakeCaseOverrides: Record<string, string> = {
  loginBypass2fa: 'login_bypass_2fa',
};

function toSnakeCase(key: string): string {
  return snakeCaseOverrides[key] ?? key.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// camelCase conversion mirrors the backend's snake_case keys. camel->snake is lossy around
// digits (`login_bypass_2fa` and `login_bypass2fa` both camelize to `loginBypass2fa`), so
// incoming responses are matched by camelizing the raw keys rather than snake-casing schema keys.
function toCamelCase(key: string): string {
  return key.replace(/_([a-z0-9])/gi, (_, letter: string) => letter.toUpperCase());
}

// z.json() is a lazy union of exactly the JSON value types. It represents opaque arbitrary
// JSON, so its value must pass through verbatim: no snake_case->camelCase key remap and no
// __extension_data collection, leaving the raw backend payload intact (e.g. the activity log
// `data` field). Recognised structurally so any bare z.json() works, no wrapper needed.
const JSON_UNION_TYPES = ['string', 'number', 'boolean', 'null', 'array', 'record'];

function isOpaqueJson(schema: AnySchema): boolean {
  const { type } = def<{ type: string }>(schema);
  switch (type) {
    case 'optional':
    case 'nullable':
    case 'default':
      return isOpaqueJson(def<{ innerType: AnySchema }>(schema).innerType);
    case 'pipe':
      return isOpaqueJson(def<{ in: AnySchema }>(schema).in);
    case 'lazy': {
      const inner = def<{ getter: () => AnySchema }>(schema).getter();
      const innerDef = def<{ type: string; options?: AnySchema[] }>(inner);
      if (innerDef.type !== 'union' || !innerDef.options) return false;
      const optionTypes = innerDef.options.map((option) => def<{ type: string }>(option).type);
      return optionTypes.length === JSON_UNION_TYPES.length && JSON_UNION_TYPES.every((t) => optionTypes.includes(t));
    }
    default:
      return false;
  }
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
  if (isOpaqueJson(schema)) return data;

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

// Response fields the schema didn't declare (e.g. added by backend model extensions)
// are kept on the parsed object under this key, mirroring the backend's hidden
// extension_data. A plain enumerable property so it survives spreads (zustand store
// updates like `{ ...state.server, ...props }`) - it's invisible to the TS types,
// serializeForApi never sends it (schema-guided), and zod already ran, so it can't
// interfere with validation. Read it back with parseExtendedFromApi.
export const EXTENSION_DATA_KEY = '__extension_data';

// Walks raw and parsed data in parallel along the schema, stashing raw keys the
// schema shape doesn't know about on the corresponding parsed object node
function collectExtensionFields(schema: AnySchema, raw: unknown, parsed: unknown): void {
  if (isOpaqueJson(schema)) return;

  const inner = unwrap(schema);
  const { type } = def<{ type: string }>(inner);

  if (type === 'object') {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return;

    const { shape } = def<{ shape: Def }>(inner);
    const rawObj = raw as Record<string, unknown>;
    const parsedObj = parsed as Record<string, unknown>;

    const extras: Record<string, unknown> = {};
    const byCamel: Record<string, unknown> = {};
    for (const key of Object.keys(rawObj)) {
      if (key === EXTENSION_DATA_KEY) continue;

      const camelKey = toCamelCase(key);
      if (Object.hasOwn(shape, camelKey)) {
        byCamel[camelKey] = rawObj[key];
      } else {
        extras[key] = rawObj[key];
      }
    }

    if (Object.keys(extras).length) {
      parsedObj[EXTENSION_DATA_KEY] = extras;
    }

    for (const [camelKey, fieldSchema] of Object.entries(shape)) {
      const rawValue = Object.hasOwn(byCamel, camelKey) ? byCamel[camelKey] : rawObj[camelKey];
      collectExtensionFields(fieldSchema, rawValue, parsedObj[camelKey]);
    }

    return;
  }

  if (type === 'union') {
    const { options, discriminator } = def<{ options: AnySchema[]; discriminator?: string }>(inner);
    const option = selectUnionOption(options, discriminator, raw);
    if (option) collectExtensionFields(option, raw, parsed);
    return;
  }

  if (type === 'array') {
    if (!Array.isArray(raw) || !Array.isArray(parsed)) return;
    const { element } = def<{ element: AnySchema }>(inner);
    raw.forEach((item, index) => collectExtensionFields(element, item, parsed[index]));
    return;
  }

  if (type === 'record') {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    const { valueType } = def<{ valueType: AnySchema }>(inner);
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      collectExtensionFields(valueType, value, (parsed as Record<string, unknown>)[key]);
    }
  }
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
  collectExtensionFields(schema, data, result.data);
  return result.data;
}

// Typed view of the response fields a backend model extension added to a parsed API
// object - the frontend counterpart of parse_model_extension. Works on any object
// node of a parseFromApi result (e.g. `server` or `server.featureLimits`); the
// extension's schema gets the same snake_case remap and validation as parseFromApi,
// so absent fields throw unless the schema marks them optional.
export function parseExtendedFromApi<T extends z.ZodTypeAny>(schema: T, parsed: object): z.infer<T> {
  const extras = (parsed as Record<string, unknown>)[EXTENSION_DATA_KEY];
  return parseFromApi(schema, extras !== null && typeof extras === 'object' ? extras : {});
}

// collectExtensionFields stashes fields the base schema didn't know about under
// __extension_data at the node they arrived on; this walks the shapes extensions
// registered for `formId` and merges those values back onto the node under their
// real field name, so extension form fields hydrate when an update form seeds its
// values from a loaded resource. Schema-guided (reuses applyTransform), so multi-word
// keys and z.record values are handled exactly as parseFromApi would. Returns a clone;
// the input is left untouched, and a form with no registered fields is returned as-is.
export function hydrateExtensionData<T>(formId: FormId, resource: T): T {
  if (resource === null || typeof resource !== 'object' || Array.isArray(resource)) return resource;

  const shapes = window.extensionContext.extensionRegistry.forms
    .getSlots(formId)
    .map((slot) => slot.zodShape as Def | undefined)
    .filter((shape): shape is Def => !!shape && Object.keys(shape).length > 0);
  if (shapes.length === 0) return resource;

  const clone = structuredClone(resource) as Record<string, unknown>;
  for (const shape of shapes) {
    mergeExtensionShape(shape, clone);
  }

  return clone as T;
}

function mergeExtensionShape(shape: Def, node: Record<string, unknown> | undefined): void {
  if (node === null || node === undefined || typeof node !== 'object') return;

  const extras = node[EXTENSION_DATA_KEY];
  const extrasObj =
    extras !== null && typeof extras === 'object' && !Array.isArray(extras) ? (extras as Record<string, unknown>) : {};

  for (const [fieldKey, fieldSchema] of Object.entries(shape)) {
    const existing = node[fieldKey];

    if (existing !== null && typeof existing === 'object' && !Array.isArray(existing)) {
      const inner = unwrap(fieldSchema);
      if (def<{ type: string }>(inner).type === 'object') {
        mergeExtensionShape(def<{ shape: Def }>(inner).shape, existing as Record<string, unknown>);
        continue;
      }
    }

    const snakeKey = toSnakeCase(fieldKey);
    let rawValue: unknown;
    if (Object.hasOwn(extrasObj, snakeKey)) {
      rawValue = extrasObj[snakeKey];
    } else if (Object.hasOwn(extrasObj, fieldKey)) {
      rawValue = extrasObj[fieldKey];
    } else {
      continue;
    }

    node[fieldKey] = applyTransform(fieldSchema, rawValue);
  }
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

// Recursively merges plain objects; arrays and scalars from `source` replace the target value
function deepMergeSerialized(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing !== null &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      deepMergeSerialized(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
}

// Main entry point for outgoing request bodies. `extraSchemas` serialize additional
// fields the core schema doesn't know about (e.g. registered by extensions through
// the form registry, see formExtensionSchemas) and are deep-merged into the result.
export function serializeForApi<T extends z.ZodTypeAny>(
  schema: T,
  data: z.infer<T>,
  extraSchemas: z.ZodTypeAny[] = [],
): unknown {
  const base = applyReverseTransform(schema, data);
  if (extraSchemas.length === 0 || base === null || typeof base !== 'object' || Array.isArray(base)) {
    return base;
  }

  for (const extra of extraSchemas) {
    const serialized = applyReverseTransform(extra, data);
    if (serialized !== null && typeof serialized === 'object' && !Array.isArray(serialized)) {
      deepMergeSerialized(base as Record<string, unknown>, serialized as Record<string, unknown>);
    }
  }

  return base;
}

// The zod shapes extensions registered for a form, as schemas for serializeForApi -
// endpoints that submit an extensible form pass these so extension fields survive
// the schema-guided serialization
export function formExtensionSchemas(formId: FormId): z.ZodTypeAny[] {
  return window.extensionContext.extensionRegistry.forms
    .getSlots(formId)
    .filter((slot) => slot.zodShape && Object.keys(slot.zodShape).length > 0)
    .map((slot) => z.object(slot.zodShape as z.ZodRawShape));
}
