import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseAgentHostUpdateSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (hostUuid: string, data: z.infer<typeof adminDatabaseAgentHostUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/database-agent-hosts/${hostUuid}`,
    serializeForApi(
      adminDatabaseAgentHostUpdateSchema,
      data,
      formExtensionSchemas('admin.databaseAgentHosts.createOrUpdate'),
    ),
  );
};
