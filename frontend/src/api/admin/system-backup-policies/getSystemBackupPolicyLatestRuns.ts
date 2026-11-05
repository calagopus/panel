import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSystemBackupPolicyLatestRunsSchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminSystemBackupPolicyLatestRunsSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/system-backup-policies/latest-runs');
  return parseFromApi(adminSystemBackupPolicyLatestRunsSchema, data.latest_runs);
};
