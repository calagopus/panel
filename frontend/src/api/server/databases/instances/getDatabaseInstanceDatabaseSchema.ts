import { z } from 'zod';
import { axiosInstance, msgpackResponseConfig } from '@/api/axios.ts';
import { serverDatabaseSchemaSchema, serverDatabaseSchemaTableSchema } from '@/lib/schemas/server/databases.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseUuid: string,
): Promise<z.infer<typeof serverDatabaseSchemaSchema>> => {
  const { data } = await axiosInstance.get(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/explorer/schema`,
    msgpackResponseConfig,
  );
  return {
    tables: data.tables.map((item: unknown) => parseFromApi(serverDatabaseSchemaTableSchema, item)),
    truncated: data.truncated,
  };
};
