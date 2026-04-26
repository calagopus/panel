import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerMountSchema } from '@/lib/schemas/admin/servers.ts';

export default async (
  serverUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminServerMountSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/${serverUuid}/mounts/available`, {
    params: { page, per_page: 100, search },
  });
  return data.mounts;
};
