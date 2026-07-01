export interface OverrideEntry {
  original: unknown;
  replacement: unknown;
}

/**
 * Declares a compile-time replacement for a core component or module export.
 *
 * The `extension-overrides` Vite plugin statically resolves `original` and `replacement` back to
 * their source files at build time and rewrites every import of `original` to `replacement`.
 * `NoInfer` pins the replacement's type to the original's, so a drifted replacement fails
 * typechecking (and breaks the build) instead of silently shipping a mismatched component.
 */
export function defineOverride<T>(original: T, replacement: NoInfer<T>): OverrideEntry {
  return { original, replacement };
}
