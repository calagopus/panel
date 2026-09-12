import { axiosInstance } from '@/api/axios.ts';

export default async (policyUuid: string, databaseAgentHostUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/system-backup-policies/${policyUuid}/database-agent-hosts`, {
    database_agent_host_uuid: databaseAgentHostUuid,
  });
};
