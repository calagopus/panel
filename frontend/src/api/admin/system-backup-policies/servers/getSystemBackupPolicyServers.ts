import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminSystemBackupPolicyServerSchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';

export default async (
  policyUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminSystemBackupPolicyServerSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/system-backup-policies/${policyUuid}/servers`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminSystemBackupPolicyServerSchema, data.servers);
};
