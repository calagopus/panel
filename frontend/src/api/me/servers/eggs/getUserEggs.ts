import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { serverEggSchema } from '@/lib/schemas/server/server.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof serverEggSchema>>> => {
  const { data } = await axiosInstance.get('/api/client/servers/eggs', {
    params: { page, search },
  });
  return parsePaginationFromApi(serverEggSchema, data.nest_eggs);
};
