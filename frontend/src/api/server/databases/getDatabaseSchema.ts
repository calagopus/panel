import { z } from 'zod';
import { axiosInstance, msgpackResponseConfig } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverDatabaseSchemaSchema, serverDatabaseSchemaTableSchema } from '@/lib/schemas/server/databases.ts';

export default async (uuid: string, databaseUuid: string): Promise<z.infer<typeof serverDatabaseSchemaSchema>> => {
  const { data } = await axiosInstance.get(
    `/api/client/servers/${uuid}/databases/${databaseUuid}/explorer/schema`,
    msgpackResponseConfig,
  );
  return {
    tables: data.tables.map((item: unknown) => parseFromApi(serverDatabaseSchemaTableSchema, item)),
    truncated: data.truncated,
  };
};
