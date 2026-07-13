import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminDatabaseAgentHostCapacitySchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';

export default async (hostUuid: string): Promise<z.infer<typeof adminDatabaseAgentHostCapacitySchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/database-agent-hosts/${hostUuid}/capacity`);
  return parseFromApi(adminDatabaseAgentHostCapacitySchema, data);
};
