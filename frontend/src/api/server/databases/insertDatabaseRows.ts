import { z } from 'zod';
import { axiosInstance, msgpackConfig } from '@/api/axios.ts';
import { serverDatabaseRowsInsertSchema } from '@/lib/schemas/server/databases.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  databaseUuid: string,
  insertData: z.infer<typeof serverDatabaseRowsInsertSchema>,
): Promise<number> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/${databaseUuid}/explorer/rows/insert`,
    serializeForApi(serverDatabaseRowsInsertSchema, insertData),
    msgpackConfig,
  );
  return data.affected;
};
