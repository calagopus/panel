import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeAllocationSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (
  nodeUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminNodeAllocationSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/allocations/available`, {
    params: { page, per_page: 100, search },
  });
  return data.allocations;
};
