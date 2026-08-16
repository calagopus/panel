import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';

export default async (uuid: string, databaseUuid: string): Promise<z.infer<typeof serverDatabaseSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/${databaseUuid}`);
  return parseFromApi(serverDatabaseSchema, data.database);
};
