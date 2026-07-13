/** Lazy variants resolve at render time, so callers (e.g. extensions) can pass translation getters from module scope. */
export type LazyString = string | (() => string);

export function resolveString(value: LazyString): string;
export function resolveString(value?: LazyString): string | undefined;
export function resolveString(value?: LazyString): string | undefined {
  return typeof value === 'function' ? value() : value;
}
