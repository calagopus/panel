export function appendInheritedIgnoredFiles(ignoredFiles: string[], inherited: string[]): string[] {
  return inherited.length === 0 ? ignoredFiles : [...ignoredFiles, ...inherited];
}

export function endsWithInheritedIgnoredFiles(ignoredFiles: string[], inherited: string[]): boolean {
  const offset = ignoredFiles.length - inherited.length;

  return offset >= 0 && inherited.every((pattern, index) => ignoredFiles[offset + index] === pattern);
}

export function stripInheritedIgnoredFiles(ignoredFiles: string[], inherited: string[]): string[] {
  if (inherited.length === 0 || !endsWithInheritedIgnoredFiles(ignoredFiles, inherited)) {
    return ignoredFiles;
  }

  return ignoredFiles.slice(0, ignoredFiles.length - inherited.length);
}
