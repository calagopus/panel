import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseHostCountsSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminDatabaseHostCountsSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/database-hosts/counts');
  return parseFromApi(adminDatabaseHostCountsSchema, data.database_hosts);
};
