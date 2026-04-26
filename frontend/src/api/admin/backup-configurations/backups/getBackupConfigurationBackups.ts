import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (
  backupConfigUuid: string,
  page: number,
  search?: string,
  detached?: boolean,
): Promise<Pagination<z.infer<typeof adminNodeServerBackupSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/backup-configurations/${backupConfigUuid}/backups`, {
    params: { page, search, detached },
  });
  return data.backups;
};
