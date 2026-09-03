import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseCreateSchema, serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  databaseData: z.infer<typeof serverDatabaseCreateSchema>,
): Promise<z.infer<typeof serverDatabaseSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases`,
    serializeForApi(serverDatabaseCreateSchema, databaseData),
  );
  return parseFromApi(serverDatabaseSchema, data.database);
};
