import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminSystemBackupPolicyLocationSchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';

export default async (
  policyUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminSystemBackupPolicyLocationSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/system-backup-policies/${policyUuid}/locations`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminSystemBackupPolicyLocationSchema, data.locations);
};
