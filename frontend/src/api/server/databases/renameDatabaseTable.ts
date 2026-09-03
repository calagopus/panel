import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseTableRenameSchema } from '@/lib/schemas/server/databases.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  databaseUuid: string,
  renameData: z.infer<typeof serverDatabaseTableRenameSchema>,
): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/${databaseUuid}/explorer/tables/rename`,
    serializeForApi(serverDatabaseTableRenameSchema, renameData),
  );
};
