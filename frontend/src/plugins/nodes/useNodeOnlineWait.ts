import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import getNodeSystemOverview from '@/api/admin/nodes/system/getNodeSystemOverview.ts';
import { queryKeys } from '@/lib/queryKeys.ts';

const POLL_INTERVAL_MS = 2_000;

export type NodeOnlineWaitStatus = 'idle' | 'waiting' | 'connected' | 'timeout';

export function useNodeOnlineWait() {
  const [nodeUuid, setNodeUuid] = useState<string | null>(null);
  const [timeoutMs, setTimeoutMs] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  const { data } = useQuery({
    queryKey: [...queryKeys.admin.nodes.systemOverview(nodeUuid ?? ''), 'online-wait'],
    queryFn: () => getNodeSystemOverview(nodeUuid!),
    enabled: !!nodeUuid && !timedOut,
    retry: false,
    refetchInterval: (query) => (query.state.data ? false : POLL_INTERVAL_MS),
    gcTime: 0,
  });

  useEffect(() => {
    if (!nodeUuid || data) return;

    const timeout = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timeout);
  }, [nodeUuid, data, timeoutMs]);

  const status: NodeOnlineWaitStatus = !nodeUuid ? 'idle' : data ? 'connected' : timedOut ? 'timeout' : 'waiting';

  return {
    status,
    version: data?.version ?? null,
    start: (uuid: string, timeout: number) => {
      setTimedOut(false);
      setTimeoutMs(timeout);
      setNodeUuid(uuid);
    },
  };
}
