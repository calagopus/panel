import { z } from 'zod';
import { untransformedAxiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';

export default async (backupConfigUuid: string): Promise<z.infer<typeof adminBackupConfigurationSchema>> => {
  const { data } = await untransformedAxiosInstance.get(`/api/admin/backup-configurations/${backupConfigUuid}`);
  return parseFromApi(adminBackupConfigurationSchema, data.backup_configuration);
};
