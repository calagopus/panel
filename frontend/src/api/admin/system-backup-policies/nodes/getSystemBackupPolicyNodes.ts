import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminSystemBackupPolicyNodeSchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';

export default async (
  policyUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminSystemBackupPolicyNodeSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/system-backup-policies/${policyUuid}/nodes`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminSystemBackupPolicyNodeSchema, data.nodes);
};
