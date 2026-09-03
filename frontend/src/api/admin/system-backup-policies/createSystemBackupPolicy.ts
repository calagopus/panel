import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  adminSystemBackupPolicySchema,
  adminSystemBackupPolicyUpdateSchema,
} from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  policyData: z.infer<typeof adminSystemBackupPolicyUpdateSchema>,
): Promise<z.infer<typeof adminSystemBackupPolicySchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/system-backup-policies',
    serializeForApi(
      adminSystemBackupPolicyUpdateSchema,
      policyData,
      formExtensionSchemas('admin.systemBackupPolicies.createOrUpdate'),
    ),
  );
  return parseFromApi(adminSystemBackupPolicySchema, data.system_backup_policy);
};
