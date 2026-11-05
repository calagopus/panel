import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSystemBackupPolicyRunSchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  policyUuid: string,
  page: number,
  perPage?: number,
): Promise<Pagination<z.infer<typeof adminSystemBackupPolicyRunSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/system-backup-policies/${policyUuid}/runs`, {
    params: { page, per_page: perPage },
  });
  return parsePaginationFromApi(adminSystemBackupPolicyRunSchema, data.runs);
};
