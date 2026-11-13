import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import getDatabaseInstanceResources from '@/api/server/databases/instances/getDatabaseInstanceResources.ts';
import postDatabaseInstancePower from '@/api/server/databases/instances/postDatabaseInstancePower.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export function useDatabaseInstancePowerState(instanceUuid: string | null | undefined, enabled: boolean) {
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const canPower = useServerCan('database-instances.power');

  const [startRequested, setStartRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: queryKeys.server(server.uuid).databases.instances.resources(instanceUuid ?? ''),
    queryFn: () => getDatabaseInstanceResources(server.uuid, instanceUuid!),
    enabled: enabled && !!instanceUuid,
    retry: false,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === 'starting' || state === 'stopping' || (startRequested && state !== 'running') ? 2000 : false;
    },
  });

  const state = data?.state ?? null;

  useEffect(() => {
    if (state === 'running' || !enabled) setStartRequested(false);
  }, [state, enabled]);

  useEffect(() => setStartRequested(false), [instanceUuid]);

  const start = () => {
    if (!instanceUuid) return;

    setRequesting(true);
    postDatabaseInstancePower(server.uuid, instanceUuid, 'start')
      .then(() => {
        setStartRequested(true);
        refetch();
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setRequesting(false));
  };

  return {
    state,
    loading: isFetching && !data,
    canStart: canPower && state === 'offline',
    starting: requesting || state === 'starting' || (startRequested && state !== 'running'),
    start,
  };
}
