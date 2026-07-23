import { MantineColor } from '@mantine/core';

export function usagePercent(progress?: number | null, total?: number | null): number | null {
  return typeof progress === 'number' && typeof total === 'number' && total > 0
    ? Math.min(100, Math.max(0, (progress / total) * 100))
    : null;
}

export function usageColor(progress?: number | null, total?: number | null): MantineColor | undefined {
  const percent = usagePercent(progress, total);
  if (percent === null) return undefined;
  if (percent >= 100) return 'red';
  if (percent >= 80) return 'yellow';
  return undefined;
}
