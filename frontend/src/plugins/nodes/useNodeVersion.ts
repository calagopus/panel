import getNodeSystemDirect from '@/api/admin/nodes/system/getNodeSystemDirect.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminNode } from '@/lib/schemas/admin/nodes.ts';
import { isOutdated } from '@/lib/version.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useAdminStore } from '@/stores/admin.tsx';

export function useNodeUpdateAvailable(version: string | null | undefined): boolean {
  const updateInformation = useAdminStore((state) => state.updateInformation);

  if (!version || !updateInformation) {
    return false;
  }

  return isOutdated(updateInformation.latestWingsVersion, version);
}

interface UseNodeVersionResult {
  version: string | null;
  unavailable: boolean;
  loading: boolean;
  updateAvailable: boolean;
}

export function useNodeVersion(node: AdminNode, options?: { enabled?: boolean }): UseNodeVersionResult {
  const enabled = options?.enabled ?? true;

  const { data, error, loading } = useResource({
    queryKey: [...queryKeys.admin.nodes.systemDirect(node.uuid), node.publicUrl ?? node.url],
    queryFn: () => getNodeSystemDirect(node),
    enabled,
    silent: true,
  });

  const version = data?.version ?? null;

  return {
    version,
    unavailable: !!error,
    loading: loading && data === undefined && !error,
    updateAvailable: useNodeUpdateAvailable(version),
  };
}
