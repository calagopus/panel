import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerUpdateSchema } from '@/lib/schemas/admin/servers.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  serverUuid: string,
  data: z.infer<typeof adminServerUpdateSchema> | { suspended: boolean },
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/servers/${serverUuid}`,
    serializeForApi(
      adminServerUpdateSchema,
      data as z.infer<typeof adminServerUpdateSchema>,
      formExtensionSchemas('admin.servers.update'),
    ),
  );
};
