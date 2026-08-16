import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverDatabaseTableDeleteSchema } from '@/lib/schemas/server/databases.ts';

export default async (
  uuid: string,
  databaseUuid: string,
  deleteData: z.infer<typeof serverDatabaseTableDeleteSchema>,
): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/${databaseUuid}/explorer/tables/delete`,
    serializeForApi(serverDatabaseTableDeleteSchema, deleteData),
  );
};
