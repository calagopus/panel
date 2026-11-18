import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  backupConfigUuid: string,
  page: number,
  search?: string,
  perPage?: number,
): Promise<Pagination<z.infer<typeof adminDatabaseAgentHostSchema>>> => {
  const { data } = await axiosInstance.get(
    `/api/admin/backup-configurations/${backupConfigUuid}/database-agent-hosts`,
    {
      params: { page, per_page: perPage, search },
    },
  );
  return parsePaginationFromApi(adminDatabaseAgentHostSchema, data.database_agent_hosts);
};
