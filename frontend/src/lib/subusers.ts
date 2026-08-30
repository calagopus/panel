export function appendInheritedIgnoredFiles(ignoredFiles: string[], inherited: string[]): string[] {
  return inherited.length === 0 ? ignoredFiles : [...ignoredFiles, ...inherited];
}

export function stripInheritedIgnoredFiles(ignoredFiles: string[], inherited: string[]): string[] {
  if (inherited.length === 0 || ignoredFiles.length < inherited.length) {
    return ignoredFiles;
  }

  const offset = ignoredFiles.length - inherited.length;

  return inherited.every((pattern, index) => ignoredFiles[offset + index] === pattern)
    ? ignoredFiles.slice(0, offset)
    : ignoredFiles;
}
