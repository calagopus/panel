import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (nodeUuid: string): Promise<z.infer<typeof adminNodeSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}`);
  return parseFromApi(adminNodeSchema, data.node);
};
