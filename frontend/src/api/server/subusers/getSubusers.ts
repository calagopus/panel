import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { serverSubuserSchema } from '@/lib/schemas/server/subusers.ts';

export default async (
  uuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof serverSubuserSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/subusers`, {
    params: { page, search },
  });
  return parsePaginationFromApi(serverSubuserSchema, data.subusers);
};
