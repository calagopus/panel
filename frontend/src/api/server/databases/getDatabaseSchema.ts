import { z } from 'zod';
import { axiosInstance, msgpackResponseConfig } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverDatabaseSchemaTableSchema } from '@/lib/schemas/server/databases.ts';

export default async (
  uuid: string,
  databaseUuid: string,
): Promise<z.infer<typeof serverDatabaseSchemaTableSchema>[]> => {
  const { data } = await axiosInstance.get(
    `/api/client/servers/${uuid}/databases/${databaseUuid}/explorer/schema`,
    msgpackResponseConfig,
  );
  return data.tables.map((item: unknown) => parseFromApi(serverDatabaseSchemaTableSchema, item));
};
