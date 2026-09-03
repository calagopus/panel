import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseTableCreateSchema } from '@/lib/schemas/server/databases.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseUuid: string,
  tableData: z.infer<typeof serverDatabaseTableCreateSchema>,
): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/explorer/tables`,
    serializeForApi(serverDatabaseTableCreateSchema, tableData),
  );
};
