import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  adminSystemBackupPolicyRunTargetSchema,
  systemBackupPolicyRunTargetStatus,
} from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  policyUuid: string,
  runUuid: string,
  page: number,
  search?: string,
  status?: z.infer<typeof systemBackupPolicyRunTargetStatus> | null,
  perPage?: number,
): Promise<Pagination<z.infer<typeof adminSystemBackupPolicyRunTargetSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/system-backup-policies/${policyUuid}/runs/${runUuid}/targets`, {
    params: { page, per_page: perPage, search, status: status ?? undefined },
  });
  return parsePaginationFromApi(adminSystemBackupPolicyRunTargetSchema, data.targets);
};
