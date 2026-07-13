import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';

export default async (hostUuid: string): Promise<z.infer<typeof adminDatabaseAgentHostSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/database-agent-hosts/${hostUuid}`);
  return parseFromApi(adminDatabaseAgentHostSchema, data.database_agent_host);
};
