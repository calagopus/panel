import { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { patchPaginatedItems } from '@/lib/queryCache.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDeviceSchema } from '@/lib/schemas/server/devices.ts';

export function setDeviceAttached(queryClient: QueryClient, serverUuid: string, deviceUuid: string, attached: boolean) {
  patchPaginatedItems<z.infer<typeof serverDeviceSchema>>(
    queryClient,
    queryKeys.server(serverUuid).devices.all(),
    (device) => (device.uuid === deviceUuid ? { ...device, created: attached ? new Date() : null } : device),
  );
}
