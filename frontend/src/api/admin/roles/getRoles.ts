import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { roleSchema } from '@/lib/schemas/user.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof roleSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/roles', {
    params: { page, search },
  });
  return parsePaginationFromApi(roleSchema, data.roles);
};
