import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { archiveFormat } from '@/lib/schemas/server/files.ts';

export const backupQuerySchema = z.object({
  archiveFormat: archiveFormat.nullable(),
  size: z.number().nullable(),
});

export default async (uuid: string, backupUuid: string): Promise<z.infer<typeof backupQuerySchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/backups/${backupUuid}/query`);
  return backupQuerySchema.parse(data);
};
