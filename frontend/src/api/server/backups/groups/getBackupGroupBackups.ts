import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';

export default async (
  serverUuid: string,
  backupGroupUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof serverBackupSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${serverUuid}/backups/groups/${backupGroupUuid}`, {
    params: { page, search },
  });
  return parsePaginationFromApi(serverBackupSchema, data.backups);
};
