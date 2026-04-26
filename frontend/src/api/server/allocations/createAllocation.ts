import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';

export default async (uuid: string): Promise<z.infer<typeof serverAllocationSchema>> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/allocations`);
  return data.allocation;
};
