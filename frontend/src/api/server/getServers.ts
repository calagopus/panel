import { z } from 'zod';
import { axiosInstance, getPaginationSet } from '@/api/axios.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';

export default async (
  page: number,
  search?: string,
  other?: boolean,
): Promise<Pagination<z.infer<typeof serverSchema>>> => {
  const { data } = await axiosInstance.get('/api/client/servers', {
    params: { page, per_page: 26, search, other },
  });
  return {
    ...getPaginationSet(data.servers),
    data: data.servers.data || [],
  };
};
