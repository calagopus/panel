import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (nodeUuid: string, name: string): Promise<z.infer<typeof adminNodeSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/duplicate`, { name });
  return data.node;
};
