import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  page: number,
  search?: string,
  other?: boolean,
): Promise<Pagination<z.infer<typeof serverSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/tunnel/connections/available`, {
    params: { page, per_page: 26, search, other },
  });
  return parsePaginationFromApi(serverSchema, data.servers);
};
