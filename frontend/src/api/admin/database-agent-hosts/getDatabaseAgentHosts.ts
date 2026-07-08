import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';

export default async (
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminDatabaseAgentHostSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/database-agent-hosts', {
    params: { page, search },
  });
  return data.databaseAgentHosts;
};
