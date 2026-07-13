import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import {
  serverDatabaseInstanceCreateSchema,
  serverDatabaseInstanceSchema,
} from '@/lib/schemas/server/databaseInstances.ts';

export default async (
  uuid: string,
  instanceData: z.infer<typeof serverDatabaseInstanceCreateSchema>,
): Promise<z.infer<typeof serverDatabaseInstanceSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances`,
    serializeForApi(serverDatabaseInstanceCreateSchema, instanceData),
  );
  return parseFromApi(serverDatabaseInstanceSchema, data.instance);
};
