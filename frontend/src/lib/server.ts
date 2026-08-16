import { z } from 'zod';
import { isAdmin } from '@/lib/permissions.ts';
import { adminNodeAllocationSchema } from '@/lib/schemas/admin/nodes.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { serverPowerState, serverSchema, serverStatus } from '@/lib/schemas/server/server.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export function isConflictingState(
  server: z.infer<typeof serverSchema>,
  user: z.infer<typeof fullUserSchema> | null = null,
): boolean {
  return (server.isSuspended && !isAdmin(user)) || server.status !== null || server.isTransferring;
}

export const serverStatusInfo: Record<
  z.infer<typeof serverStatus>,
  { failed: boolean; badgeColor: string; label: () => string; blockContent: () => string }
> = {
  installing: {
    failed: false,
    badgeColor: 'blue',
    label: () => getTranslations().t('common.server.state.installing', {}),
    blockContent: () => getTranslations().t('elements.screenBlock.serverConflict.contentInstalling', {}),
  },
  install_failed: {
    failed: true,
    badgeColor: 'red',
    label: () => getTranslations().t('common.server.state.installFailed', {}),
    blockContent: () => getTranslations().t('elements.screenBlock.serverConflict.contentInstallFailed', {}),
  },
  restoring_backup: {
    failed: false,
    badgeColor: 'orange',
    label: () => getTranslations().t('common.server.state.restoringBackup', {}),
    blockContent: () => getTranslations().t('elements.screenBlock.serverConflict.contentRestoringBackup', {}),
  },
  backup_restore_failed: {
    failed: true,
    badgeColor: 'red',
    label: () => getTranslations().t('common.server.state.backupRestoreFailed', {}),
    blockContent: () => getTranslations().t('elements.screenBlock.serverConflict.contentBackupRestoreFailed', {}),
  },
};

export function isTransientStatus(status: z.infer<typeof serverStatus> | null | undefined): boolean {
  return !!status && !serverStatusInfo[status].failed;
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
      return 'bg-server-status-running';
    case 'starting':
      return 'bg-server-status-starting';
    case 'stopping':
      return 'bg-server-status-stopping';
    case 'offline':
      return 'bg-server-status-offline';
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
