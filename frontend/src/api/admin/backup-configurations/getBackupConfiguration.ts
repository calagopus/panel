import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (backupConfigUuid: string): Promise<z.infer<typeof adminBackupConfigurationSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/backup-configurations/${backupConfigUuid}`);
  return parseFromApi(adminBackupConfigurationSchema, data.backup_configuration);
};
