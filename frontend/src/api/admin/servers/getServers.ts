import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof adminServerSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/servers', {
    params: { page, search },
  });
  return data.servers;
};
