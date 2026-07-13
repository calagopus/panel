import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';

export default async (
  serverGroupUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof serverSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/groups/${serverGroupUuid}`, {
    params: { page, search },
  });
  return parsePaginationFromApi(serverSchema, data.servers);
};
