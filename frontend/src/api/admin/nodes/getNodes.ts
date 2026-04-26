import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof adminNodeSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/nodes', {
    params: { page, search },
  });
  return data.nodes;
};
