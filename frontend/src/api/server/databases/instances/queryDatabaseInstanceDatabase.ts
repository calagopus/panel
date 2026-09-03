import { z } from 'zod';
import { axiosInstance, msgpackConfig } from '@/api/axios.ts';
import { serverDatabaseQueryResultSchema, serverDatabaseQuerySchema } from '@/lib/schemas/server/databases.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseUuid: string,
  queryData: z.infer<typeof serverDatabaseQuerySchema>,
): Promise<z.infer<typeof serverDatabaseQueryResultSchema>[]> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/explorer/query`,
    serializeForApi(serverDatabaseQuerySchema, queryData),
    msgpackConfig,
  );
  return data.results.map((item: unknown) => parseFromApi(serverDatabaseQueryResultSchema, item));
};
