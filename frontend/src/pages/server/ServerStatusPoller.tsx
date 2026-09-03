import { useEffect, useState } from 'react';
import getServer from '@/api/server/getServer.ts';
import { isTransientStatus } from '@/lib/domain/server.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { usePollingResource } from '@/plugins/resource/usePollingResource.ts';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';

const STALE_CACHE_GRACE = 6000;

export default function ServerStatusPoller() {
  const serverStoreApi = useServerStoreApi();
  const uuid = useServerStore((state) => state.server.uuid);
  const status = useServerStore((state) => state.server.status);
  const updateServer = useServerStore((state) => state.updateServer);
  const [pollable, setPollable] = useState(false);

  useEffect(() => {
    setPollable(false);

    const timeout = setTimeout(() => setPollable(true), STALE_CACHE_GRACE);
    return () => clearTimeout(timeout);
  }, [uuid, status]);

  const { data } = usePollingResource({
    queryKey: queryKeys.server(uuid).detail(),
    queryFn: () => getServer(uuid),
    interval: 15000,
    enabled: !!uuid && isTransientStatus(status) && pollable,
    silent: true,
  });

  useEffect(() => {
    if (!data) return;

    const current = serverStoreApi.getState().server;
    if (current.uuid !== data.uuid || !isTransientStatus(current.status)) return;

    updateServer(data);
  }, [data]);

  return null;
}
