import getNodeCapacities from '@/api/admin/nodes/getNodeCapacities.ts';
import { getNodeDeploymentState, getNodeDeploymentUsage, NodeDeploymentState } from '@/lib/domain/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminNode } from '@/lib/schemas/admin/nodes.ts';
import { useResource } from '@/plugins/resource/useResource.ts';

interface UseNodeDeploymentResult {
  state: NodeDeploymentState;
  usage: ReturnType<typeof getNodeDeploymentUsage> | null;
  servers: number | null;
  loading: boolean;
}

export function useNodeDeployment(node: AdminNode): UseNodeDeploymentResult {
  const { data, loading } = useResource({
    queryKey: queryKeys.admin.nodes.capacities(),
    queryFn: getNodeCapacities,
    silent: true,
  });

  const allocated = data?.[node.uuid];
  const state = getNodeDeploymentState(node, allocated);

  return {
    state,
    usage: allocated ? getNodeDeploymentUsage(node, allocated) : null,
    servers: data === undefined ? null : (allocated?.servers ?? 0),
    loading: loading && data === undefined && state === 'available',
  };
}
