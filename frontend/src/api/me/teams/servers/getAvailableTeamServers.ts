import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  teamUuid: string,
  page: number,
  search?: string,
  perPage?: number,
): Promise<Pagination<z.infer<typeof serverSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/teams/${teamUuid}/servers/available`, {
    params: { page, per_page: perPage, search },
  });
  return parsePaginationFromApi(serverSchema, data.servers);
};
