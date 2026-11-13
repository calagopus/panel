import { mbToBytes } from '@/lib/format/size.ts';

export function freeDiskBytes(diskLimitMb: number, diskBytes: number | null): number | null {
  if (diskLimitMb === 0 || diskBytes === null) return null;
  return mbToBytes(diskLimitMb) - diskBytes;
}
