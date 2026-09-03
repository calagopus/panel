import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseInstanceDatabaseSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  instanceUuid: string,
): Promise<z.infer<typeof serverDatabaseInstanceDatabaseSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases`);
  return data.databases.map((item: unknown) => parseFromApi(serverDatabaseInstanceDatabaseSchema, item));
};
