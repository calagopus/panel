import { z } from 'zod';
import { axiosInstance, getPaginationSet } from '@/api/axios.ts';
import { userSessionSchema } from '@/lib/schemas/user/sessions.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof userSessionSchema>>> => {
  const { data } = await axiosInstance.get('/api/client/account/sessions', {
    params: { page, search },
  });
  return {
    ...getPaginationSet(data.sessions),
    data: data.sessions.data || [],
  };
};
