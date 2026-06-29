import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverBackupEditSchema } from '@/lib/schemas/server/backups.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  uuid: string,
  backupUuid: string,
  data: z.infer<typeof serverBackupEditSchema>,
): Promise<void> => {
  await axiosInstance.patch(`/api/client/servers/${uuid}/backups/${backupUuid}`, transformKeysToSnakeCase(data));
};
