const SIGNALS: Record<number, string> = {
  1: 'SIGHUP',
  2: 'SIGINT',
  3: 'SIGQUIT',
  4: 'SIGILL',
  6: 'SIGABRT',
  7: 'SIGBUS',
  8: 'SIGFPE',
  9: 'SIGKILL',
  11: 'SIGSEGV',
  13: 'SIGPIPE',
  15: 'SIGTERM',
};

/** Name of the signal a shell-style exit code (128 + signal number) reports, or `null` for a regular exit. */
export function exitCodeSignal(exitCode: number): string | null {
  return exitCode > 128 ? (SIGNALS[exitCode - 128] ?? null) : null;
}
