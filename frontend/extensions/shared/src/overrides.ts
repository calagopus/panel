export interface OverrideEntry {
  original: unknown;
  replacement: unknown;
}
function defineOverride<T>(original: T, replacement: NoInfer<T>): OverrideEntry {
  return { original, replacement };
}
