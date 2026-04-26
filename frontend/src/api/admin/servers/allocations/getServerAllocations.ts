import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';

export default async (
  serverUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof serverAllocationSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/${serverUuid}/allocations`, {
    params: { page, per_page: 100, search },
  });
  return data.allocations;
};
