import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseColumnCreateSchema } from '@/lib/schemas/server/databases.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseUuid: string,
  columnData: z.infer<typeof serverDatabaseColumnCreateSchema>,
): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/explorer/tables/columns`,
    serializeForApi(serverDatabaseColumnCreateSchema, columnData),
  );
};
