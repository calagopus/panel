import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { transferArchiveFormat } from '@/lib/schemas/generic.ts';
import { compressionLevel } from '@/lib/schemas/server/files.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  nodeUuid: string;
  allocationUuid: string | null;
  allocationUuids: string[];
  backups: string[];
  deleteSourceBackups: boolean;
  archiveFormat: z.infer<typeof transferArchiveFormat>;
  compressionLevel: z.infer<typeof compressionLevel> | null;
  multiplexChannels: number;
}

export default async (serverUuid: string, data: Data): Promise<void> => {
  await axiosInstance.post(`/api/admin/servers/${serverUuid}/transfer`, transformKeysToSnakeCase(data));
};
