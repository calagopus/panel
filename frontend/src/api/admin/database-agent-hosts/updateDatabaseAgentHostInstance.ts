import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminDatabaseAgentHostInstanceUpdateSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';

export default async (
  hostUuid: string,
  instanceUuid: string,
  data: z.infer<typeof adminDatabaseAgentHostInstanceUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/database-agent-hosts/${hostUuid}/instances/${instanceUuid}`,
    serializeForApi(adminDatabaseAgentHostInstanceUpdateSchema, data),
  );
};
