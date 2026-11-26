import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerDatabaseAgentSchema } from '@/lib/schemas/admin/servers.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (instanceUuid: string): Promise<z.infer<typeof adminServerDatabaseAgentSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/database-instances/${encodeURIComponent(instanceUuid)}`);
  return parseFromApi(adminServerDatabaseAgentSchema, data.database_instance);
};
