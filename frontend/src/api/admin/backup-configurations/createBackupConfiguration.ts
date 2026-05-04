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
    name: backupConfigurationData.name,
    description: backupConfigurationData.description,
    maintenance_enabled: backupConfigurationData.maintenanceEnabled,
    backup_disk: backupConfigurationData.backupDisk,
    backup_configs: backupConfigurationData.backupConfigs
      ? {
          s3: backupConfigurationData.backupConfigs.s3
            ? {
                access_key: backupConfigurationData.backupConfigs.s3.accessKey,
                secret_key: backupConfigurationData.backupConfigs.s3.secretKey,
                bucket: backupConfigurationData.backupConfigs.s3.bucket,
                region: backupConfigurationData.backupConfigs.s3.region,
                endpoint: backupConfigurationData.backupConfigs.s3.endpoint,
                path_style: backupConfigurationData.backupConfigs.s3.pathStyle,
                part_size: backupConfigurationData.backupConfigs.s3.partSize,
              }
            : null,
          restic: backupConfigurationData.backupConfigs.restic
            ? {
                repository: backupConfigurationData.backupConfigs.restic.repository,
                retry_lock_seconds: backupConfigurationData.backupConfigs.restic.retryLockSeconds,
                environment: backupConfigurationData.backupConfigs.restic.environment,
              }
            : null,
        }
      : null,
  });
  return data.backupConfiguration;
};
