import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseCreateSchema, serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  uuid: string,
  databaseData: z.infer<typeof serverDatabaseCreateSchema>,
): Promise<z.infer<typeof serverDatabaseSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases`,
    transformKeysToSnakeCase(databaseData),
  );
  return data.database;
};
