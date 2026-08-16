import { z } from 'zod';
import { axiosInstance, msgpackConfig } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverDatabaseRowsUpdateSchema } from '@/lib/schemas/server/databases.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseUuid: string,
  updateData: z.infer<typeof serverDatabaseRowsUpdateSchema>,
): Promise<number> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/explorer/rows/update`,
    serializeForApi(serverDatabaseRowsUpdateSchema, updateData),
    msgpackConfig,
  );
  return data.affected;
};
