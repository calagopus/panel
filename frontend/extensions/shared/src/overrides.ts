export interface OverrideEntry {
  original: unknown;
  replacement: unknown;
}

// Part of extension system
// oxlint-disable-next-line no-unused-vars
function defineOverride<T>(original: T, replacement: NoInfer<T>): OverrideEntry {
  return { original, replacement };
}
