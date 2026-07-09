import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import {
  adminDatabaseAgentHostCreateSchema,
  adminDatabaseAgentHostSchema,
} from '@/lib/schemas/admin/databaseAgentHosts.ts';

export default async (
  hostData: z.infer<typeof adminDatabaseAgentHostCreateSchema>,
): Promise<z.infer<typeof adminDatabaseAgentHostSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/database-agent-hosts',
    serializeForApi(adminDatabaseAgentHostCreateSchema, hostData),
  );
  return parseFromApi(adminDatabaseAgentHostSchema, data.database_agent_host);
};
