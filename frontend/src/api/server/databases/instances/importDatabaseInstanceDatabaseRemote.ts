import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseInstanceRemoteImportSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseUuid: string,
  importData: z.infer<typeof serverDatabaseInstanceRemoteImportSchema>,
): Promise<string> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/import/remote`,
    serializeForApi(serverDatabaseInstanceRemoteImportSchema, importData),
  );
  return data.operation;
};
