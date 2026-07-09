import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminNodeDesyncSchema } from '@/lib/schemas/admin/system.ts';

export default async (
  page: number,
): Promise<{ desyncNodes: Pagination<z.infer<typeof adminNodeDesyncSchema>>; failedNodes: number }> => {
  const { data } = await axiosInstance.get('/api/admin/system/health/nodes', { params: { page } });
  return {
    desyncNodes: parsePaginationFromApi(adminNodeDesyncSchema, data.desync_nodes),
    failedNodes: data.failed_nodes,
  };
};
