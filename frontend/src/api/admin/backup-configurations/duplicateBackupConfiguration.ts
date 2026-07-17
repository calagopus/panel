import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';

export default async (
  backupConfigUuid: string,
  name: string,
): Promise<z.infer<typeof adminBackupConfigurationSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/backup-configurations/${backupConfigUuid}/duplicate`, {
    name,
  });
  return parseFromApi(adminBackupConfigurationSchema, data.backup_configuration);
};
