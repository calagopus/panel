import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';

export default async (
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminBackupConfigurationSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/backup-configurations', {
    params: { page, search },
  });
  return data.backupConfigurations;
};
