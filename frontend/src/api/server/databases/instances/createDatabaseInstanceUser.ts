import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  serverDatabaseInstanceUserCreateSchema,
  serverDatabaseInstanceUserSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  userData: z.infer<typeof serverDatabaseInstanceUserCreateSchema>,
): Promise<z.infer<typeof serverDatabaseInstanceUserSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/users`,
    serializeForApi(serverDatabaseInstanceUserCreateSchema, userData),
  );
  return parseFromApi(serverDatabaseInstanceUserSchema, data.user);
};
