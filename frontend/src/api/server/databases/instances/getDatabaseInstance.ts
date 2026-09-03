import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string, instanceUuid: string): Promise<z.infer<typeof serverDatabaseInstanceSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/instances/${instanceUuid}`);
  return parseFromApi(serverDatabaseInstanceSchema, data.instance);
};
