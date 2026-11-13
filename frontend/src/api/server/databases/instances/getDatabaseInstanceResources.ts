import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseInstanceResourceUsageSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  instanceUuid: string,
): Promise<z.infer<typeof serverDatabaseInstanceResourceUsageSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/instances/${instanceUuid}/resources`);
  return parseFromApi(serverDatabaseInstanceResourceUsageSchema, data.resources);
};
