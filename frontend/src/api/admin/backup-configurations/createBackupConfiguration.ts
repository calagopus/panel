import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import {
  adminBackupConfigurationSchema,
  adminBackupConfigurationUpdateSchema,
} from '@/lib/schemas/admin/backupConfigurations.ts';

export default async (
  backupConfigurationData: z.infer<typeof adminBackupConfigurationUpdateSchema>,
): Promise<z.infer<typeof adminBackupConfigurationSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/backup-configurations',
    serializeForApi(adminBackupConfigurationUpdateSchema, backupConfigurationData),
  );
  return parseFromApi(adminBackupConfigurationSchema, data.backup_configuration);
};
