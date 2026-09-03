import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof serverDatabaseInstanceSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/instances`, {
    params: { page, search },
  });
  return parsePaginationFromApi(serverDatabaseInstanceSchema, data.instances);
};
