import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  page: number,
  search?: string,
  ungrouped?: boolean,
): Promise<Pagination<z.infer<typeof serverBackupSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/backups`, {
    params: { page, search, ungrouped },
  });
  return parsePaginationFromApi(serverBackupSchema, data.backups);
};
