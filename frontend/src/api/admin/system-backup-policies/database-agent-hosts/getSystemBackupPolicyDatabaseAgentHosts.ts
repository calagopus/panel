import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSystemBackupPolicyDatabaseAgentHostSchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  policyUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminSystemBackupPolicyDatabaseAgentHostSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/system-backup-policies/${policyUuid}/database-agent-hosts`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminSystemBackupPolicyDatabaseAgentHostSchema, data.database_agent_hosts);
};
