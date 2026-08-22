import getServerGamedig, { GameDigResponse } from '@/api/server/getServerGamedig.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { usePollingResource } from './usePollingResource.ts';

export function useServerGameDig(serverUuid: string, running: boolean, interval = 30000) {
  return usePollingResource<GameDigResponse>({
    queryKey: queryKeys.server(serverUuid).gamedig(),
    queryFn: () => getServerGamedig(serverUuid),
    interval,
    enabled: running,
    silent: true,
    stopWhen: (data) => !data.enabled,
  });
}
