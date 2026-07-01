import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { backupQuerySchema } from '@/api/server/backups/queryBackup.ts';

export default async (nodeUuid: string, backupUuid: string): Promise<z.infer<typeof backupQuerySchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/backups/${backupUuid}/query`);
  return backupQuerySchema.parse(data);
};
