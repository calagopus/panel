import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string, databaseUuid: string): Promise<z.infer<typeof serverDatabaseSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/${databaseUuid}`);
  return parseFromApi(serverDatabaseSchema, data.database);
};
