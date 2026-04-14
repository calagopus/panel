import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (
  serverUuid: string,
  page: number,
  search?: string,
  partiallyDetached?: boolean,
): Promise<Pagination<z.infer<typeof adminNodeServerBackupSchema>>> => {
  return new Promise((resolve, reject) => {
    axiosInstance
      .get(`/api/admin/servers/${serverUuid}/backups`, {
        params: { page, search, partially_detached: partiallyDetached },
      })
      .then(({ data }) => resolve(data.backups))
      .catch(reject);
  });
};
