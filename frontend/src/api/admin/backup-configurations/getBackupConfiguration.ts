import { z } from 'zod';
import { untransformedAxiosInstance } from '@/api/axios.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { transformKeysToCamelCase } from '@/lib/transformers.ts';

export default async (backupConfigUuid: string): Promise<z.infer<typeof adminBackupConfigurationSchema>> => {
  const { data } = await untransformedAxiosInstance.get(`/api/admin/backup-configurations/${backupConfigUuid}`);
  return {
    ...transformKeysToCamelCase(data.backup_configuration),
    backupConfigs: {
      ...data.backup_configuration.backup_configs,
      restic: data.backup_configuration.backup_configs.restic
        ? {
            ...transformKeysToCamelCase(data.backup_configuration.backup_configs.restic),
            environment: data.backup_configuration.backup_configs.restic.environment,
          }
        : null,
    },
  } as z.infer<typeof adminBackupConfigurationSchema>;
};
