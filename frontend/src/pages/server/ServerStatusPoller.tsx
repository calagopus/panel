import { useEffect } from 'react';
import getServer from '@/api/server/getServer.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { isTransientStatus } from '@/lib/server.ts';
import { usePollingResource } from '@/plugins/usePollingResource.ts';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';

export default function ServerStatusPoller() {
  const serverStoreApi = useServerStoreApi();
  const uuid = useServerStore((state) => state.server.uuid);
  const status = useServerStore((state) => state.server.status);
  const updateServer = useServerStore((state) => state.updateServer);

  const { data } = usePollingResource({
    queryKey: queryKeys.server(uuid).detail(),
    queryFn: () => getServer(uuid),
    interval: 15000,
    enabled: !!uuid && isTransientStatus(status),
    silent: true,
    stopWhen: (server) => !isTransientStatus(server.status),
  });

  useEffect(() => {
    if (!data) return;

    const current = serverStoreApi.getState().server;
    if (current.uuid !== data.uuid || !isTransientStatus(current.status)) return;

    updateServer(data);
  }, [data]);

  return null;
}
