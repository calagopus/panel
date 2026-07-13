import { FieldDef } from './types.ts';

/*
 * Helpers for form extension `transform` functions. Insert helpers return the
 * fields unchanged when the anchor is missing, so a transform stays safe when
 * the same form id renders multiple field sections (e.g. server create/update).
 */

export function insertFieldsBefore<T extends Record<string, unknown>>(
  fields: FieldDef<T>[],
  name: string,
  ...insert: FieldDef<T>[]
): FieldDef<T>[] {
  const idx = fields.findIndex((f) => f.name === name);
  if (idx === -1) return fields;
  return [...fields.slice(0, idx), ...insert, ...fields.slice(idx)];
}

export function insertFieldsAfter<T extends Record<string, unknown>>(
  fields: FieldDef<T>[],
  name: string,
  ...insert: FieldDef<T>[]
): FieldDef<T>[] {
  const idx = fields.findIndex((f) => f.name === name);
  if (idx === -1) return fields;
  return [...fields.slice(0, idx + 1), ...insert, ...fields.slice(idx + 1)];
}

export function updateField<T extends Record<string, unknown>>(
  fields: FieldDef<T>[],
  name: string,
  update: (field: FieldDef<T>) => FieldDef<T>,
): FieldDef<T>[] {
  return fields.map((f) => (f.name === name ? update(f) : f));
}

export function removeField<T extends Record<string, unknown>>(fields: FieldDef<T>[], name: string): FieldDef<T>[] {
  return fields.filter((f) => f.name !== name);
}
