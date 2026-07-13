type MonacoGlobal = {
  Range: new (...args: unknown[]) => unknown;
  Selection: new (...args: unknown[]) => unknown;
  SelectionDirection: unknown;
};

function runtimeMonaco(): MonacoGlobal {
  const monaco = (window as unknown as { monaco?: MonacoGlobal }).monaco;
  if (!monaco) {
    throw new Error('monaco-editor accessed before the editor loader initialized it');
  }
  return monaco;
}

export class Range {
  constructor(...args: unknown[]) {
    return new (runtimeMonaco().Range)(...args) as Range;
  }
}

export class Selection {
  constructor(...args: unknown[]) {
    return new (runtimeMonaco().Selection)(...args) as Selection;
  }
}

export const SelectionDirection = new Proxy(
  {},
  {
    get: (_target, prop) => (runtimeMonaco().SelectionDirection as Record<string, unknown>)[prop as string],
  },
);
