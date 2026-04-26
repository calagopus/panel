import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';

export default async (
  uuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof serverAllocationSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/allocations`, {
    params: { page, search },
  });
  return data.allocations;
};
