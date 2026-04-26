import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof adminLocationSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/locations', {
    params: { page, search },
  });
  return data.locations;
};
