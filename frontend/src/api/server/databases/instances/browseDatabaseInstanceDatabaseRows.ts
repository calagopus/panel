import { z } from 'zod';
import { axiosInstance, msgpackConfig } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { serverDatabaseBrowseSchema, serverDatabaseQueryResultSchema } from '@/lib/schemas/server/databases.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseUuid: string,
  browseData: z.infer<typeof serverDatabaseBrowseSchema>,
): Promise<z.infer<typeof serverDatabaseQueryResultSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/explorer/rows`,
    serializeForApi(serverDatabaseBrowseSchema, browseData),
    msgpackConfig,
  );
  return parseFromApi(serverDatabaseQueryResultSchema, data.result);
};
