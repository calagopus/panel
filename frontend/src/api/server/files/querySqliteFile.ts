import { z } from 'zod';
import { axiosInstance, msgpackConfig } from '@/api/axios.ts';
import { serverDatabaseQueryResultSchema } from '@/lib/schemas/server/databases.ts';
import { serverFileSqliteQuerySchema } from '@/lib/schemas/server/files.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  queryData: z.infer<typeof serverFileSqliteQuerySchema>,
): Promise<z.infer<typeof serverDatabaseQueryResultSchema>[]> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/files/sqlite-query`,
    serializeForApi(serverFileSqliteQuerySchema, queryData),
    msgpackConfig,
  );
  return data.results.map((item: unknown) => parseFromApi(serverDatabaseQueryResultSchema, item));
};
