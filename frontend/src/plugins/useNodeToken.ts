import getNodeToken from '@/api/admin/nodes/getNodeToken.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/useResource.ts';

export function useNodeToken(nodeUuid: string | undefined, options?: { silent?: boolean }) {
  const { data, loading, error } = useResource({
    queryKey: queryKeys.admin.nodes.token(nodeUuid ?? ''),
    queryFn: () => getNodeToken(nodeUuid!),
    enabled: !!nodeUuid,
    silent: options?.silent,
  });

  return { token: data ?? null, loading, error };
}
