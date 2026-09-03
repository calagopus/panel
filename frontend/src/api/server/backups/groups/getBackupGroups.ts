import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverBackupGroupSchema } from '@/lib/schemas/server/backups.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string): Promise<z.infer<typeof serverBackupGroupSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/backups/groups`);
  return data.backup_groups.map((item: unknown) => parseFromApi(serverBackupGroupSchema, item));
};
