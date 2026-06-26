import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverBackupEditSchema } from '@/lib/schemas/server/backups.ts';

export default async (
  uuid: string,
  backupUuid: string,
  data: z.infer<typeof serverBackupEditSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/servers/${uuid}/backups/${backupUuid}`,
    serializeForApi(serverBackupEditSchema, data),
  );
};
