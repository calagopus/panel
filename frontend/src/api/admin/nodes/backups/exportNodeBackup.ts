import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

const exportNodeBackupSchema = z.object({
  serverUuid: z.string(),
  path: z.string(),
  archiveFormat: streamingArchiveFormat,
  foreground: z.boolean(),
});

export default async (
  nodeUuid: string,
  backupUuid: string,
  data: z.infer<typeof exportNodeBackupSchema>,
): Promise<void> => {
  await axiosInstance.post(
    `/api/admin/nodes/${nodeUuid}/backups/${backupUuid}/export`,
    serializeForApi(exportNodeBackupSchema, data),
  );
};
