import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverDatabaseColumnRenameSchema } from '@/lib/schemas/server/databases.ts';

export default async (
  uuid: string,
  databaseUuid: string,
  renameData: z.infer<typeof serverDatabaseColumnRenameSchema>,
): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/${databaseUuid}/explorer/tables/columns/rename`,
    serializeForApi(serverDatabaseColumnRenameSchema, renameData),
  );
};
