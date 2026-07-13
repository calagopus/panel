import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import {
  serverDatabaseInstanceDatabaseCreateSchema,
  serverDatabaseInstanceDatabaseSchema,
} from '@/lib/schemas/server/databaseInstances.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseData: z.infer<typeof serverDatabaseInstanceDatabaseCreateSchema>,
): Promise<z.infer<typeof serverDatabaseInstanceDatabaseSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases`,
    serializeForApi(serverDatabaseInstanceDatabaseCreateSchema, databaseData),
  );
  return parseFromApi(serverDatabaseInstanceDatabaseSchema, data.database);
};
