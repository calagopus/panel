import { isFullyHex } from '@/lib/network/ip.ts';

/**
 * Given a valid six character HEX color code, converts it into its associated
 * RGBA value with a user controllable alpha channel.
 */
export function hexToRgba(hex: string, alpha = 1): string {
  hex = hex.trim().replace('#', '');

  if (hex.length !== 6 || !isFullyHex(hex)) {
    return hex;
  }

  const rSegment = hex.slice(0, 2);
  const gSegment = hex.slice(2, 4);
  const bSegment = hex.slice(4, 6);

  const r = parseInt(rSegment, 16);
  const g = parseInt(gSegment, 16);
  const b = parseInt(bSegment, 16);

  if ([r, g, b].some((v) => Number.isNaN(v))) {
    return hex;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
