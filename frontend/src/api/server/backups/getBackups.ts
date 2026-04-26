import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';

export default async (
  uuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof serverBackupSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/backups`, {
    params: { page, search },
  });
  return data.backups;
};
