import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerUpdateSchema } from '@/lib/schemas/admin/servers.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface SuspendedServer {
  suspended: boolean;
}

export default async (
  serverUuid: string,
  data: z.infer<typeof adminServerUpdateSchema> | SuspendedServer,
): Promise<void> => {
  await axiosInstance.patch(`/api/admin/servers/${serverUuid}`, transformKeysToSnakeCase(data));
};
