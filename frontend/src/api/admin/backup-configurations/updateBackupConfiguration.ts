import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/api-transform.ts';
import { adminBackupConfigurationUpdateSchema } from '@/lib/schemas/admin/backupConfigurations.ts';

export default async (
  backupConfigUuid: string,
  data: z.infer<typeof adminBackupConfigurationUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/backup-configurations/${backupConfigUuid}`,
    serializeForApi(adminBackupConfigurationUpdateSchema, data, [
      ...formExtensionSchemas('admin.backupConfigurations.createOrUpdate'),
      ...formExtensionSchemas('admin.backupConfigurations.pbs'),
      ...formExtensionSchemas('admin.backupConfigurations.s3'),
      ...formExtensionSchemas('admin.backupConfigurations.restic'),
      ...formExtensionSchemas('admin.backupConfigurations.kopia'),
    ]),
  );
};
