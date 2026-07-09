import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (
  serverUuid: string,
  page: number,
  search?: string,
  partiallyDetached?: boolean,
): Promise<Pagination<z.infer<typeof adminNodeServerBackupSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/${serverUuid}/backups`, {
    params: { page, search, partially_detached: partiallyDetached },
  });
  return parsePaginationFromApi(adminNodeServerBackupSchema, data.backups);
};
