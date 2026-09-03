import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverEggSchema } from '@/lib/schemas/server/server.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof serverEggSchema>>> => {
  const { data } = await axiosInstance.get('/api/client/servers/eggs', {
    params: { page, search },
  });
  return parsePaginationFromApi(serverEggSchema, data.nest_eggs);
};
