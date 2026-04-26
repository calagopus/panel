import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof adminMountSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/mounts', {
    params: { page, search },
  });
  return data.mounts;
};
