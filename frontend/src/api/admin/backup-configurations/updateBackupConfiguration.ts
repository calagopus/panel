import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminBackupConfigurationUpdateSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  backupConfigUuid: string,
  data: z.infer<typeof adminBackupConfigurationUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(`/api/admin/backup-configurations/${backupConfigUuid}`, {
    name: data.name,
    description: data.description,
    maintenance_enabled: data.maintenanceEnabled,
    backup_disk: data.backupDisk,
    backup_configs: data.backupConfigs
      ? {
          s3: data.backupConfigs.s3
            ? {
                access_key: data.backupConfigs.s3.accessKey,
                secret_key: data.backupConfigs.s3.secretKey,
                bucket: data.backupConfigs.s3.bucket,
                region: data.backupConfigs.s3.region,
                endpoint: data.backupConfigs.s3.endpoint,
                path_style: data.backupConfigs.s3.pathStyle,
                part_size: data.backupConfigs.s3.partSize,
              }
            : null,
          restic: data.backupConfigs.restic
            ? {
                repository: data.backupConfigs.restic.repository,
                retry_lock_seconds: data.backupConfigs.restic.retryLockSeconds,
                environment: data.backupConfigs.restic.environment,
              }
            : null,
        }
      : null,
  });
};
