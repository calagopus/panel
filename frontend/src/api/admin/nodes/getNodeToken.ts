import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeTokenSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (nodeUuid: string): Promise<z.infer<typeof adminNodeTokenSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/token`);
  return data;
};
