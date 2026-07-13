import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';

export default async (hostUuid: string): Promise<z.infer<typeof adminDatabaseHostSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/database-hosts/${hostUuid}`);
  return parseFromApi(adminDatabaseHostSchema, data.database_host);
};
