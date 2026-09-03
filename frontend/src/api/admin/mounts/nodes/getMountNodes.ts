import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

const nodeMountSchema = z.object({
  node: adminNodeSchema,
  created: z.coerce.date(),
});

export default async (
  mountUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof nodeMountSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/mounts/${mountUuid}/nodes`, {
    params: { page, search },
  });
  return parsePaginationFromApi(nodeMountSchema, data.node_mounts);
};
