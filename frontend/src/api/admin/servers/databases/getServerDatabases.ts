import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminServerServerDatabaseSchema } from '@/lib/schemas/admin/servers.ts';

export default async (
  serverUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminServerServerDatabaseSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/${serverUuid}/databases`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminServerServerDatabaseSchema, data.databases);
};
