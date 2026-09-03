import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSystemBackupPolicyLocationSchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

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
