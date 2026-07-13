import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminServerDatabaseAgentSchema } from '@/lib/schemas/admin/servers.ts';

export default async (
  templateUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminServerDatabaseAgentSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/database-agent-templates/${templateUuid}/instances`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminServerDatabaseAgentSchema, data.instances);
};
