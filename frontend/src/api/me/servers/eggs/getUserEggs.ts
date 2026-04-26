import { z } from 'zod';
import { axiosInstance, getPaginationSet } from '@/api/axios.ts';
import { serverEggSchema } from '@/lib/schemas/server/server.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof serverEggSchema>>> => {
  const { data } = await axiosInstance.get('/api/client/servers/eggs', {
    params: { page, search },
  });
  return {
    ...getPaginationSet(data.nestEggs),
    data: data.nestEggs.data || [],
  };
};
