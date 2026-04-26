import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';

export default async (
  nodeUuid: string,
  backupUuid: string,
  archiveFormat: z.infer<typeof streamingArchiveFormat>,
): Promise<{ url: string }> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/backups/${backupUuid}/download`, {
    params: { archive_format: archiveFormat },
  });
  return data;
};
