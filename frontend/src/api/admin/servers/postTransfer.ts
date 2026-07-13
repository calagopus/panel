import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { transferArchiveFormat } from '@/lib/schemas/generic.ts';
import { compressionLevel } from '@/lib/schemas/server/files.ts';

const transferSchema = z.object({
  nodeUuid: z.string(),
  allocationUuid: z.string().nullable(),
  allocationUuids: z.array(z.string()),
  backups: z.array(z.string()),
  deleteSourceBackups: z.boolean(),
  archiveFormat: transferArchiveFormat,
  compressionLevel: compressionLevel.nullable(),
  multiplexChannels: z.number(),
});

export default async (serverUuid: string, data: z.infer<typeof transferSchema>): Promise<void> => {
  await axiosInstance.post(`/api/admin/servers/${serverUuid}/transfer`, serializeForApi(transferSchema, data));
};
