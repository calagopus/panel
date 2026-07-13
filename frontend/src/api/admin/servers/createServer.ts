import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { adminServerCreateSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';

export default async (
  serverData: z.infer<typeof adminServerCreateSchema>,
): Promise<z.infer<typeof adminServerSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/servers',
    serializeForApi(adminServerCreateSchema, serverData, formExtensionSchemas('admin.servers.create')),
  );
  return parseFromApi(adminServerSchema, data.server);
};
