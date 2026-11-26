import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerDatabaseSchema } from '@/lib/schemas/admin/servers.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (database: string): Promise<z.infer<typeof adminServerDatabaseSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/databases/${encodeURIComponent(database)}`);
  return parseFromApi(adminServerDatabaseSchema, data.database);
};
