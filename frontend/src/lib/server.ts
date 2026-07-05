import { z } from 'zod';
import { isAdmin } from '@/lib/permissions.ts';
import { adminNodeAllocationSchema } from '@/lib/schemas/admin/nodes.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { serverPowerState, serverSchema } from '@/lib/schemas/server/server.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export function isConflictingState(
  server: z.infer<typeof serverSchema>,
  user: z.infer<typeof fullUserSchema> | null = null,
): boolean {
  return (server.isSuspended && !isAdmin(user)) || server.status !== null || server.isTransferring;
}

export function formatAllocation(
  allocation?: z.infer<typeof serverAllocationSchema> | z.infer<typeof adminNodeAllocationSchema> | null,
  separatePort: boolean = false,
) {
  return allocation
    ? separatePort
      ? allocation.ipAlias || allocation.ip
      : `${allocation.ipAlias || allocation.ip}:${allocation.port}`
    : getTranslations().t('common.server.noAllocation', {});
}

export function statusToColor(status: z.infer<typeof serverPowerState> | undefined) {
  switch (status) {
    case 'running':
      return 'bg-green-500';
    case 'starting':
      return 'bg-yellow-500';
    case 'stopping':
      return 'bg-red-500';
    case 'offline':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

export function generateBackupName() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const tzOffset = now.getTimezoneOffset();
  const tzSign = tzOffset <= 0 ? '+' : '-';
  const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tzMinutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');
  const tzFormatted = `${tzSign}${tzHours}${tzMinutes}`;

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${tzFormatted}`;
}
