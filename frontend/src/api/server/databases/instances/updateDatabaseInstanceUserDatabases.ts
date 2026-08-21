import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import {
  serverDatabaseInstanceUserDatabaseSchema,
  serverDatabaseInstanceUserDatabasesUpdateSchema,
} from '@/lib/schemas/server/databaseInstances.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  userUuid: string,
  data: z.infer<typeof serverDatabaseInstanceUserDatabasesUpdateSchema>,
): Promise<z.infer<typeof serverDatabaseInstanceUserDatabaseSchema>[]> => {
  const { data: response } = await axiosInstance.put(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/users/${userUuid}/databases`,
    serializeForApi(serverDatabaseInstanceUserDatabasesUpdateSchema, data),
  );
  return response.databases.map((item: unknown) => parseFromApi(serverDatabaseInstanceUserDatabaseSchema, item));
};
