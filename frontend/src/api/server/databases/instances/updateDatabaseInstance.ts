import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseInstanceEditSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

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
