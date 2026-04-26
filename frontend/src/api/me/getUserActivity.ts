import { z } from 'zod';
import { axiosInstance, getPaginationSet } from '@/api/axios.ts';
import { userActivitySchema } from '@/lib/schemas/user/activity.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof userActivitySchema>>> => {
  const { data } = await axiosInstance.get('/api/client/account/activity', {
    params: { page, search },
  });
  return {
    ...getPaginationSet(data.activities),
    data: data.activities.data || [],
  };
};
