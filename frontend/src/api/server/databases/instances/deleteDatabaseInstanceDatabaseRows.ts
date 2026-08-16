import { z } from 'zod';
import { axiosInstance, msgpackConfig } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverDatabaseRowsDeleteSchema } from '@/lib/schemas/server/databases.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseUuid: string,
  deleteData: z.infer<typeof serverDatabaseRowsDeleteSchema>,
): Promise<number> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/explorer/rows/delete`,
    serializeForApi(serverDatabaseRowsDeleteSchema, deleteData),
    msgpackConfig,
  );
  return data.affected;
};
