import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';

export default async (uuid: string, instanceUuid: string): Promise<z.infer<typeof serverDatabaseInstanceSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/instances/${instanceUuid}`);
  return parseFromApi(serverDatabaseInstanceSchema, data.instance);
};
