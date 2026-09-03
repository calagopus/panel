import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseColumnDeleteSchema } from '@/lib/schemas/server/databases.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseUuid: string,
  deleteData: z.infer<typeof serverDatabaseColumnDeleteSchema>,
): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/explorer/tables/columns/delete`,
    serializeForApi(serverDatabaseColumnDeleteSchema, deleteData),
  );
};
