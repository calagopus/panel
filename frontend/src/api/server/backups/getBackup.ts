import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';

export default async (uuid: string, backupUuid: string): Promise<z.infer<typeof serverBackupSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/backups/${backupUuid}`);
  return data.backup;
};
