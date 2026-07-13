import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverDatabaseInstanceUserSchema } from '@/lib/schemas/server/databaseInstances.ts';

export default async (
  uuid: string,
  instanceUuid: string,
): Promise<z.infer<typeof serverDatabaseInstanceUserSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/instances/${instanceUuid}/users`);
  return data.users.map((item: unknown) => parseFromApi(serverDatabaseInstanceUserSchema, item));
};
