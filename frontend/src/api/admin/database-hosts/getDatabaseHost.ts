import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (hostUuid: string): Promise<z.infer<typeof adminDatabaseHostSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/database-hosts/${hostUuid}`);
  return parseFromApi(adminDatabaseHostSchema, data.database_host);
};
