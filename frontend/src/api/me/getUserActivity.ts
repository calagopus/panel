import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { userActivitySchema } from '@/lib/schemas/user/activity.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof userActivitySchema>>> => {
  const { data } = await axiosInstance.get('/api/client/account/activity', {
    params: { page, search },
  });
  return parsePaginationFromApi(userActivitySchema, data.activities);
};
