type MathModule = typeof import('mathjs');

let mathModule: Promise<MathModule> | null = null;
let loadedMath: MathModule | null = null;

export function loadMath(): Promise<MathModule> {
  mathModule ??= import('mathjs')
    .then((math) => {
      loadedMath = math;
      return math;
    })
    .catch((error) => {
      mathModule = null;
      throw error;
    });

  return mathModule;
}

export function getLoadedMath(): MathModule | null {
  return loadedMath;
}

export function evaluateMathExpression(math: MathModule, expression: string): string | null {
  let result: unknown;
  try {
    result = math.evaluate(expression);
  } catch {
    return null;
  }

  if (result === undefined || result === null || typeof result === 'function') return null;
  if (typeof result === 'number' && Number.isNaN(result)) return null;

  try {
    return math.format(result, { precision: 14 });
  } catch {
    return null;
  }
}
