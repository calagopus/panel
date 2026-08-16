import { z } from 'zod';
import { axiosInstance, msgpackConfig } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { serverDatabaseQueryResultSchema, serverDatabaseQuerySchema } from '@/lib/schemas/server/databases.ts';

export default async (
  uuid: string,
  databaseUuid: string,
  queryData: z.infer<typeof serverDatabaseQuerySchema>,
): Promise<z.infer<typeof serverDatabaseQueryResultSchema>[]> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/${databaseUuid}/explorer/query`,
    serializeForApi(serverDatabaseQuerySchema, queryData),
    msgpackConfig,
  );
  return data.results.map((item: unknown) => parseFromApi(serverDatabaseQueryResultSchema, item));
};
