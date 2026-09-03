import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof adminDatabaseHostSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/database-hosts', {
    params: { page, search },
  });
  return parsePaginationFromApi(adminDatabaseHostSchema, data.database_hosts);
};
