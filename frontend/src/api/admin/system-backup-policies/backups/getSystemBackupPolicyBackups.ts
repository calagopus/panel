import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  policyUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminNodeServerBackupSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/system-backup-policies/${policyUuid}/backups`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminNodeServerBackupSchema, data.backups);
};
