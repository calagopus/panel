import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (
  mountUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<AndCreated<{ node: z.infer<typeof adminNodeSchema> }>>> => {
  const { data } = await axiosInstance.get(`/api/admin/mounts/${mountUuid}/nodes`, {
    params: { page, search },
  });
  return data.nodeMounts;
};
