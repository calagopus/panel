import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { backupQuerySchema } from '@/api/server/backups/queryBackup.ts';
import { parseFromApi } from '@/lib/api-transform.ts';

export default async (nodeUuid: string, backupUuid: string): Promise<z.infer<typeof backupQuerySchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/backups/${backupUuid}/query`);
  return parseFromApi(backupQuerySchema, data);
};
