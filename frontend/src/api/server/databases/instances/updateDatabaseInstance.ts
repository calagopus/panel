import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverDatabaseInstanceEditSchema } from '@/lib/schemas/server/databaseInstances.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  data: z.infer<typeof serverDatabaseInstanceEditSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}`,
    serializeForApi(serverDatabaseInstanceEditSchema, data),
  );
};
