import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { userSessionSchema } from '@/lib/schemas/user/sessions.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof userSessionSchema>>> => {
  const { data } = await axiosInstance.get('/api/client/account/sessions', {
    params: { page, search },
  });
  return parsePaginationFromApi(userSessionSchema, data.sessions);
};
