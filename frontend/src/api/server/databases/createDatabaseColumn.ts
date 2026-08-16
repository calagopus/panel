import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverDatabaseColumnCreateSchema } from '@/lib/schemas/server/databases.ts';

export default async (
  uuid: string,
  databaseUuid: string,
  columnData: z.infer<typeof serverDatabaseColumnCreateSchema>,
): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/${databaseUuid}/explorer/tables/columns`,
    serializeForApi(serverDatabaseColumnCreateSchema, columnData),
  );
};
