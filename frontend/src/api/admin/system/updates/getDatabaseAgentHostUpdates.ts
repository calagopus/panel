import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseAgentHostUpdateInformationSchema } from '@/lib/schemas/admin/system.ts';

export default async (
  page: number,
): Promise<{
  outdatedDatabaseAgentHosts: Pagination<z.infer<typeof adminDatabaseAgentHostUpdateInformationSchema>>;
  failedDatabaseAgentHosts: number;
}> => {
  const { data } = await axiosInstance.get('/api/admin/system/updates/database-agent-hosts', { params: { page } });
  return data;
};
