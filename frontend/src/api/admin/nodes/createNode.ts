import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { adminNodeSchema, adminNodeUpdateSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (nodeData: z.infer<typeof adminNodeUpdateSchema>): Promise<z.infer<typeof adminNodeSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/nodes', serializeForApi(adminNodeUpdateSchema, nodeData));
  return parseFromApi(adminNodeSchema, data.node);
};
