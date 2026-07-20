import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminServerServerDatabaseAgentSchema } from '@/lib/schemas/admin/servers.ts';

export default async (
  serverUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminServerServerDatabaseAgentSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/${serverUuid}/databases/instances`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminServerServerDatabaseAgentSchema, data.instances);
};
