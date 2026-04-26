import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeMountSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (
  nodeUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminNodeMountSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/mounts`, {
    params: { page, search },
  });
  return data.mounts;
};
