import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';

const restoreBackupSchema = z.object({
  truncateDirectory: z.boolean(),
  restoreStartup: z.boolean(),
});

export default async (uuid: string, backupUuid: string, data: z.infer<typeof restoreBackupSchema>): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/backups/${backupUuid}/restore`,
    serializeForApi(restoreBackupSchema, data),
  );
};
