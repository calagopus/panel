import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverBackupFilterSchema, serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  page: number,
  search?: string,
  ungrouped?: boolean,
  filter?: z.infer<typeof serverBackupFilterSchema>,
): Promise<Pagination<z.infer<typeof serverBackupSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/backups`, {
    params: {
      page,
      search,
      ungrouped,
      kind: filter?.kind,
      database_instance_uuid: filter?.databaseInstanceUuid,
      database_type: filter?.databaseType,
    },
  });
  return parsePaginationFromApi(serverBackupSchema, data.backups);
};
