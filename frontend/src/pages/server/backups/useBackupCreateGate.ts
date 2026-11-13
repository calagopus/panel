import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { z } from 'zod';
import getBackups from '@/api/server/backups/getBackups.ts';
import getBackupUsage from '@/api/server/backups/getBackupUsage.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useServerStore } from '@/stores/server.ts';

type ServerBackup = z.infer<typeof serverBackupSchema>;

function expendableTier(backup: ServerBackup, now: number): number | null {
  const status = backup.retentionStatus;
  if (backup.isLocked || !backup.completed || backup.deletionStatus || !status) return null;

  if (status.state === 'failed' && status.expires && status.expires.getTime() <= now) return 0;
  if (status.state === 'expired') return 1;

  return null;
}

export function findExpendableBackup(backups: ServerBackup[], now = Date.now()): ServerBackup | null {
  let best: { tier: number; backup: ServerBackup } | null = null;

  for (const backup of backups) {
    const tier = expendableTier(backup, now);
    if (tier === null) continue;

    if (!best || tier < best.tier || (tier === best.tier && backup.created.getTime() < best.backup.created.getTime())) {
      best = { tier, backup };
    }
  }

  return best?.backup ?? null;
}

export function useBackupCreateGate(enabled = true) {
  const server = useServerStore((state) => state.server);
  const canCreateBackup = useServerCan('backups.create');
  const keys = queryKeys.server(server.uuid).backups;
  const limit = server.featureLimits.backups;

  const { data: usage, isError: usageFailed } = useQuery({
    queryKey: keys.usage(),
    queryFn: () => getBackupUsage(server.uuid),
    enabled,
  });

  const total = usage ? usage.server + usage.databaseInstance : null;
  const atLimit = total !== null && total >= limit;

  const { data: candidates } = useQuery({
    queryKey: [...keys.all(), 'eviction-candidates'],
    queryFn: () => getBackups(server.uuid, 1, undefined, false, undefined, 100),
    enabled: enabled && canCreateBackup && atLimit && limit > 0,
  });

  const expendable = useMemo(
    () => (atLimit && candidates ? findExpendableBackup(candidates.data) : null),
    [atLimit, candidates],
  );

  return {
    usage,
    usageFailed,
    countKnown: usage !== undefined || usageFailed,
    atLimit,
    expendable,
    blocked: atLimit && !expendable,
  };
}
