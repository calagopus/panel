import { z } from 'zod';
import getPermissions from '@/api/getPermissions.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { apiPermissionsSchema } from '@/lib/schemas/generic.ts';
import { useResource } from '@/plugins/resource/useResource.ts';

const EMPTY_PERMISSIONS: z.infer<typeof apiPermissionsSchema> = {
  adminPermissions: {},
  userPermissions: {},
  serverPermissions: {},
};

export function useAvailablePermissions(options?: { silent?: boolean }) {
  const { data, loading, initialLoading, error, refetch } = useResource({
    queryKey: queryKeys.global.permissions.all(),
    queryFn: getPermissions,
    silent: options?.silent ?? true,
  });

  return { availablePermissions: data ?? EMPTY_PERMISSIONS, loading, initialLoading, error, refetch };
}
