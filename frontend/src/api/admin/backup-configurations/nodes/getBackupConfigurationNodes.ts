import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (
  backupConfigUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminNodeSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/backup-configurations/${backupConfigUuid}/nodes`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminNodeSchema, data.nodes);
};
