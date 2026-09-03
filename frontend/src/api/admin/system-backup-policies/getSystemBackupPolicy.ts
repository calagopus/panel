import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (policyUuid: string): Promise<z.infer<typeof adminSystemBackupPolicySchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/system-backup-policies/${policyUuid}`);
  return parseFromApi(adminSystemBackupPolicySchema, data.system_backup_policy);
};
