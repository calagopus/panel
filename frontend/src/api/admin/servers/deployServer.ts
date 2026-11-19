import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerDeploySchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  serverData: z.infer<typeof adminServerDeploySchema>,
): Promise<z.infer<typeof adminServerSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/servers/deploy',
    serializeForApi(adminServerDeploySchema, serverData, formExtensionSchemas('admin.servers.create')),
  );
  return parseFromApi(adminServerSchema, data.server);
};
