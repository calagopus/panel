import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof adminFullUserSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/users', {
    params: { page, search },
  });
  return parsePaginationFromApi(adminFullUserSchema, data.users);
};
