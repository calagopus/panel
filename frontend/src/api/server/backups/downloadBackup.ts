import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';

export default async (
  uuid: string,
  backupUuid: string,
  archiveFormat: z.infer<typeof streamingArchiveFormat>,
): Promise<{ url: string }> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/backups/${backupUuid}/download`, {
    params: { archive_format: archiveFormat },
  });
  return data;
};
