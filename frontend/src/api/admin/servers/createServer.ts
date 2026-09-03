import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerCreateSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  serverData: z.infer<typeof adminServerCreateSchema>,
): Promise<z.infer<typeof adminServerSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/servers',
    serializeForApi(adminServerCreateSchema, serverData, formExtensionSchemas('admin.servers.create')),
  );
  return parseFromApi(adminServerSchema, data.server);
};
