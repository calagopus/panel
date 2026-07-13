import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import {
  adminBackupConfigurationSchema,
  adminBackupConfigurationUpdateSchema,
} from '@/lib/schemas/admin/backupConfigurations.ts';

export default async (
  backupConfigurationData: z.infer<typeof adminBackupConfigurationUpdateSchema>,
): Promise<z.infer<typeof adminBackupConfigurationSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/backup-configurations',
    serializeForApi(adminBackupConfigurationUpdateSchema, backupConfigurationData, [
      ...formExtensionSchemas('admin.backupConfigurations.createOrUpdate'),
      ...formExtensionSchemas('admin.backupConfigurations.pbs'),
      ...formExtensionSchemas('admin.backupConfigurations.s3'),
      ...formExtensionSchemas('admin.backupConfigurations.restic'),
      ...formExtensionSchemas('admin.backupConfigurations.kopia'),
    ]),
  );
  return parseFromApi(adminBackupConfigurationSchema, data.backup_configuration);
};
