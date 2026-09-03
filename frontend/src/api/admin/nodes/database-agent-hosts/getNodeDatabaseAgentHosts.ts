import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeDatabaseAgentHostSchema } from '@/lib/schemas/admin/nodes.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  nodeUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminNodeDatabaseAgentHostSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/database-agent-hosts`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminNodeDatabaseAgentHostSchema, data.database_agent_hosts);
};
