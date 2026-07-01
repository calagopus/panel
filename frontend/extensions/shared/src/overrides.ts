export interface OverrideEntry {
  original: unknown;
  replacement: unknown;
}
// biome-ignore lint/correctness/noUnusedVariables: part of extension system
function defineOverride<T>(original: T, replacement: NoInfer<T>): OverrideEntry {
  return { original, replacement };
}
