import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';

export default async (
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminBackupConfigurationSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/backup-configurations', {
    params: { page, search },
  });
  return parsePaginationFromApi(adminBackupConfigurationSchema, data.backup_configurations);
};
