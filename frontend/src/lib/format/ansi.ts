// Source: https://github.com/chalk/strip-ansi/blob/main/index.js

export function ansiRegex({ onlyFirst = false } = {}) {
  // Valid string terminator sequences are BEL, ESC\, and 0x9c
  const ST = '(?:\\u0007|\\u001B\\u005C|\\u009C)';

  // OSC sequences only: ESC ] ... ST (non-greedy until the first ST)
  const osc = `(?:\\u001B\\][\\s\\S]*?${ST})`;

  // CSI and related: ESC/C1, optional intermediates, optional params (supports ; and :) then final byte
  const csi = '[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]';

  const pattern = `${osc}|${csi}`;

  return new RegExp(pattern, onlyFirst ? undefined : 'g');
}

export function stripAnsi(string: string) {
  // Fast path: ANSI codes require ESC (7-bit) or CSI (8-bit) introducer
  if (!string.includes('\u001B') && !string.includes('\u009B')) {
    return string;
  }

  // Even though the regex is global, we don't need to reset the `.lastIndex`
  // because unlike `.exec()` and `.test()`, `.replace()` does it automatically
  // and doing it manually has a performance penalty.
  return string.replace(ansiRegex(), '');
}
