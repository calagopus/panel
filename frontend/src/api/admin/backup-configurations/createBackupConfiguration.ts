import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  adminBackupConfigurationSchema,
  adminBackupConfigurationUpdateSchema,
} from '@/lib/schemas/admin/backupConfigurations.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  backupConfigurationData: z.infer<typeof adminBackupConfigurationUpdateSchema>,
): Promise<z.infer<typeof adminBackupConfigurationSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/backup-configurations', {
    ...transformKeysToSnakeCase(backupConfigurationData),
    backup_configs: backupConfigurationData.backupConfigs
      ? {
          ...transformKeysToSnakeCase(backupConfigurationData.backupConfigs),
          restic: backupConfigurationData.backupConfigs.restic
            ? {
                ...transformKeysToSnakeCase(backupConfigurationData.backupConfigs.restic),
                environment: backupConfigurationData.backupConfigs.restic.environment,
              }
            : null,
        }
      : null,
  });
  return data.backupConfiguration;
};
