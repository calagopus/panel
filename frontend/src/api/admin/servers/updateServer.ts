import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminServerUpdateSchema } from '@/lib/schemas/admin/servers.ts';

export default async (
  serverUuid: string,
  data: z.infer<typeof adminServerUpdateSchema> | { suspended: boolean },
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/servers/${serverUuid}`,
    serializeForApi(adminServerUpdateSchema, data as z.infer<typeof adminServerUpdateSchema>),
  );
};
