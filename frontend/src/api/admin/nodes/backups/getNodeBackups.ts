import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminServerBackupSchema } from '@/lib/schemas/admin/servers.ts';

export default async (
  nodeUuid: string,
  page: number,
  search?: string,
  detached?: boolean,
): Promise<Pagination<z.infer<typeof adminServerBackupSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/backups`, {
    params: { page, search, detached },
  });
  return parsePaginationFromApi(adminServerBackupSchema, data.backups);
};
