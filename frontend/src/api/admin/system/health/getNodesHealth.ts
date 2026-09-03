import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeDesyncSchema } from '@/lib/schemas/admin/system.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  page: number,
): Promise<{ desyncNodes: Pagination<z.infer<typeof adminNodeDesyncSchema>>; failedNodes: number }> => {
  const { data } = await axiosInstance.get('/api/admin/system/health/nodes', { params: { page } });
  return {
    desyncNodes: parsePaginationFromApi(adminNodeDesyncSchema, data.desync_nodes),
    failedNodes: data.failed_nodes,
  };
};
