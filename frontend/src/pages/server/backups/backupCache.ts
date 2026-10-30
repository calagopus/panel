import { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { patchPaginatedItems } from '@/lib/queryCache.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';

type ServerBackup = z.infer<typeof serverBackupSchema>;

interface BackupUpdate {
  name?: string;
  locked?: boolean;
}

// patches the cached lists in place instead of refetching every backup list; only a lock change on a
// grouped backup needs the server, since its retention status and the group's lock badge depend on it
export function applyBackupUpdate(
  queryClient: QueryClient,
  serverUuid: string,
  backups: ServerBackup[],
  update: BackupUpdate,
) {
  const uuids = new Set(backups.map((backup) => backup.uuid));
  const keys = queryKeys.server(serverUuid).backups;

  const patch = (backup: ServerBackup): ServerBackup => ({
    ...backup,
    name: update.name ?? backup.name,
    isLocked: update.locked ?? backup.isLocked,
    retentionStatus:
      update.locked && backup.retentionStatus
        ? { ...backup.retentionStatus, state: 'locked', rule: null, rules: [], expires: null }
        : backup.retentionStatus,
  });

  patchPaginatedItems<ServerBackup>(queryClient, keys.all(), (backup) =>
    uuids.has(backup.uuid) ? patch(backup) : backup,
  );

  if (update.locked === undefined) return;

  const groupUuids = new Set(backups.flatMap((backup) => (backup.backupGroupUuid ? [backup.backupGroupUuid] : [])));
  if (groupUuids.size === 0) return;

  for (const groupUuid of groupUuids) {
    queryClient.invalidateQueries({ queryKey: keys.groups.detail(groupUuid) });
  }
  queryClient.invalidateQueries({ queryKey: keys.groups.all(), exact: true });
  if (!update.locked) {
    queryClient.invalidateQueries({ queryKey: keys.usage(), exact: true });
  }
}
