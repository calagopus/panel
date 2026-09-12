import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  databaseAgentHostUuid: string,
  page: number,
  search?: string,
): Promise<{ backups: Pagination<z.infer<typeof adminNodeServerBackupSchema>>; failed: number }> => {
  const { data } = await axiosInstance.get(`/api/admin/database-agent-hosts/${databaseAgentHostUuid}/backups`, {
    params: { page, search },
  });
  return {
    backups: parsePaginationFromApi(adminNodeServerBackupSchema, data.backups),
    failed: data.failed,
  };
};
