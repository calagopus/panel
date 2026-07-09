import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminDatabaseAgentHostUpdateInformationSchema } from '@/lib/schemas/admin/system.ts';

export default async (
  page: number,
): Promise<{
  outdatedDatabaseAgentHosts: Pagination<z.infer<typeof adminDatabaseAgentHostUpdateInformationSchema>>;
  failedDatabaseAgentHosts: number;
}> => {
  const { data } = await axiosInstance.get('/api/admin/system/updates/database-agent-hosts', { params: { page } });
  return {
    outdatedDatabaseAgentHosts: parsePaginationFromApi(
      adminDatabaseAgentHostUpdateInformationSchema,
      data.outdated_database_agent_hosts,
    ),
    failedDatabaseAgentHosts: data.failed_database_agent_hosts,
  };
};
