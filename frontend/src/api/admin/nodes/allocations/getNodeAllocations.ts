import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminNodeAllocationFilterSchema, adminNodeAllocationSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (
  nodeUuid: string,
  page: number,
  filter?: z.infer<typeof adminNodeAllocationFilterSchema>,
  perPage = 100,
): Promise<Pagination<z.infer<typeof adminNodeAllocationSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/allocations`, {
    params: {
      page,
      per_page: perPage,
      search: filter?.search || undefined,
      ip: filter?.ip || undefined,
      port_from: filter?.portFrom ?? undefined,
      port_to: filter?.portTo ?? undefined,
      assigned: filter?.assigned ?? undefined,
    },
  });
  return parsePaginationFromApi(adminNodeAllocationSchema, data.allocations);
};
