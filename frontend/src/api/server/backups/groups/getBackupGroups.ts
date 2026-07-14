import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverBackupGroupSchema } from '@/lib/schemas/server/backups.ts';

export default async (uuid: string): Promise<z.infer<typeof serverBackupGroupSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/backups/groups`);
  return data.backup_groups.map((item: unknown) => parseFromApi(serverBackupGroupSchema, item));
};
