import { z } from 'zod';
import { axiosInstance, msgpackConfig } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverDatabaseRowsInsertSchema } from '@/lib/schemas/server/databases.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseUuid: string,
  insertData: z.infer<typeof serverDatabaseRowsInsertSchema>,
): Promise<number> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/explorer/rows/insert`,
    serializeForApi(serverDatabaseRowsInsertSchema, insertData),
    msgpackConfig,
  );
  return data.affected;
};
