import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverBackupCreateSchema, serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  backupData: z.infer<typeof serverBackupCreateSchema>,
): Promise<z.infer<typeof serverBackupSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/backups`,
    serializeForApi(serverBackupCreateSchema, backupData),
  );
  return parseFromApi(serverBackupSchema, data.backup);
};
