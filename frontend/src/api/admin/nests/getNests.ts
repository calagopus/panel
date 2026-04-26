import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof adminNestSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/nests', {
    params: { page, search },
  });
  return data.nests;
};
