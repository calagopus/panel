import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerDatabaseSchema } from '@/lib/schemas/admin/servers.ts';

export default async (
  databaseHostUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminServerDatabaseSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/database-hosts/${databaseHostUuid}/databases`, {
    params: { page, search },
  });
  return data.databases;
};
