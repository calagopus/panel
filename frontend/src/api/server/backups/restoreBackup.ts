import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverBackupRestoreSchema } from '@/lib/schemas/server/backups.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  backupUuid: string,
  data: z.infer<typeof serverBackupRestoreSchema>,
): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/backups/${backupUuid}/restore`,
    serializeForApi(serverBackupRestoreSchema, data),
  );
};
