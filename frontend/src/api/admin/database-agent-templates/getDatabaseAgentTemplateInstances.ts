import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerDatabaseAgentSchema } from '@/lib/schemas/admin/servers.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

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
