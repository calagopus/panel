import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeTokenSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (nodeUuid: string): Promise<z.infer<typeof adminNodeTokenSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/reset-token`);
  return data;
};
