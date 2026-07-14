import { useEffect } from 'react';
import { z } from 'zod';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { useUserStore } from '@/stores/user.ts';

export function useServerStats(server: z.infer<typeof adminServerSchema> | z.infer<typeof serverSchema>) {
  const subscribeToNode = useUserStore((state) => state.subscribeToNode);
  const nodeUuid = ('nodeUuid' in server ? server.nodeUuid : server.node?.uuid) as string | undefined;

  const stats = useUserStore((state) => state.serverResourceUsage[server.uuid] ?? null);

  useEffect(() => {
    if (!nodeUuid) return;
    return subscribeToNode(nodeUuid);
  }, [nodeUuid, subscribeToNode]);

  return stats;
}
