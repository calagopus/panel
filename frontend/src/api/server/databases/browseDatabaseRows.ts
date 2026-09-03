import { z } from 'zod';
import { axiosInstance, msgpackConfig } from '@/api/axios.ts';
import { serverDatabaseBrowseSchema, serverDatabaseQueryResultSchema } from '@/lib/schemas/server/databases.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  databaseUuid: string,
  browseData: z.infer<typeof serverDatabaseBrowseSchema>,
): Promise<z.infer<typeof serverDatabaseQueryResultSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/${databaseUuid}/explorer/rows`,
    serializeForApi(serverDatabaseBrowseSchema, browseData),
    msgpackConfig,
  );
  return parseFromApi(serverDatabaseQueryResultSchema, data.result);
};
