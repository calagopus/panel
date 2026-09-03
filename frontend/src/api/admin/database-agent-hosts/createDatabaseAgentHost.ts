import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  adminDatabaseAgentHostCreateSchema,
  adminDatabaseAgentHostSchema,
} from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  hostData: z.infer<typeof adminDatabaseAgentHostCreateSchema>,
): Promise<z.infer<typeof adminDatabaseAgentHostSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/database-agent-hosts',
    serializeForApi(
      adminDatabaseAgentHostCreateSchema,
      hostData,
      formExtensionSchemas('admin.databaseAgentHosts.createOrUpdate'),
    ),
  );
  return parseFromApi(adminDatabaseAgentHostSchema, data.database_agent_host);
};
