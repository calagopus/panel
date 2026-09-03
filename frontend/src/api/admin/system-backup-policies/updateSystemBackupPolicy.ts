import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSystemBackupPolicyUpdateSchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  policyUuid: string,
  policyData: z.infer<typeof adminSystemBackupPolicyUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/system-backup-policies/${policyUuid}`,
    serializeForApi(
      adminSystemBackupPolicyUpdateSchema,
      policyData,
      formExtensionSchemas('admin.systemBackupPolicies.createOrUpdate'),
    ),
  );
};
