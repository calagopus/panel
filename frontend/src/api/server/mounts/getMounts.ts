import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverMountSchema } from '@/lib/schemas/server/mounts.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  page: number,
  search?: string,
  perPage?: number,
): Promise<Pagination<z.infer<typeof serverMountSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/mounts`, {
    params: { page, per_page: perPage, search },
  });
  return parsePaginationFromApi(serverMountSchema, data.mounts);
};
