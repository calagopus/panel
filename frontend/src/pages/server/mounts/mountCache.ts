import { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { patchPaginatedItems } from '@/lib/queryCache.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverMountSchema } from '@/lib/schemas/server/mounts.ts';

export function setMountAttached(queryClient: QueryClient, serverUuid: string, mountUuid: string, attached: boolean) {
  patchPaginatedItems<z.infer<typeof serverMountSchema>>(
    queryClient,
    queryKeys.server(serverUuid).mounts.all(),
    (mount) => (mount.uuid === mountUuid ? { ...mount, created: attached ? new Date() : null } : mount),
  );
}
