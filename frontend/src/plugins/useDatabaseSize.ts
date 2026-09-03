import getDatabaseSize from '@/api/server/databases/getDatabaseSize.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/resource/useResource.ts';

export function useDatabaseSize(serverUuid: string, databaseUuid: string) {
  const { data, loading } = useResource({
    queryKey: queryKeys.server(serverUuid).databases.size(databaseUuid),
    queryFn: () => getDatabaseSize(serverUuid, databaseUuid),
    silent: true,
  });

  return { size: data ?? 0, loading: loading && data === undefined };
}
