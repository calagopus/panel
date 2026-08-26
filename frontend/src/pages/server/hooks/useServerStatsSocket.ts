import { useEffect } from 'react';
import { z } from 'zod';
import { serverResourceUsageSchema } from '@/lib/schemas/server/server.ts';
import { transformKeysToCamelCase } from '@/lib/transformers.ts';
import useWebsocketEvent, { SocketEvent, SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';
import { useUserStore } from '@/stores/user.ts';

export default function useServerStatsSocket() {
  const serverStoreApi = useServerStoreApi();
  const addServerResourceUsage = useUserStore((state) => state.addServerResourceUsage);
  const socketConnected = useServerStore((state) => state.socketConnected);
  const socketInstance = useServerStore((state) => state.socketInstance);
  const setStats = useServerStore((state) => state.setStats);
  const setPendingRestart = useServerStore((state) => state.setPendingRestart);

  useEffect(() => {
    if (!socketConnected || !socketInstance) {
      return;
    }

    socketInstance.send(SocketRequest.SEND_STATS);
  }, [socketInstance, socketConnected]);

  useWebsocketEvent(SocketEvent.STATS, (data) => {
    let resourceUsage: z.infer<typeof serverResourceUsageSchema>;
    try {
      resourceUsage = transformKeysToCamelCase(JSON.parse(data)) as z.infer<typeof serverResourceUsageSchema>;
    } catch {
      return;
    }

    setStats(resourceUsage);
    addServerResourceUsage(serverStoreApi.getState().server.uuid, resourceUsage);
  });

  useWebsocketEvent(SocketEvent.PENDING_RESTART, (pending) => {
    setPendingRestart(pending === 'true');
  });
}
