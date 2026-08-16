import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';

export default async (policyUuid: string): Promise<z.infer<typeof adminSystemBackupPolicySchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/system-backup-policies/${policyUuid}`);
  return parseFromApi(adminSystemBackupPolicySchema, data.system_backup_policy);
};
