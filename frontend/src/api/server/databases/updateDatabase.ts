import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseEditSchema } from '@/lib/schemas/server/databases.ts';

export default async (
  uuid: string,
  databaseUuid: string,
  data: z.infer<typeof serverDatabaseEditSchema>,
): Promise<void> => {
  await axiosInstance.patch(`/api/client/servers/${uuid}/databases/${databaseUuid}`, data);
};
