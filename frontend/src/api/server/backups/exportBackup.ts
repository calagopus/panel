import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

const exportBackupSchema = z.object({
  path: z.string(),
  archiveFormat: streamingArchiveFormat,
  foreground: z.boolean(),
});

export default async (uuid: string, backupUuid: string, data: z.infer<typeof exportBackupSchema>): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/backups/${backupUuid}/export`,
    serializeForApi(exportBackupSchema, data),
  );
};
