import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminNodeTokenSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (nodeUuid: string): Promise<z.infer<typeof adminNodeTokenSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/token`);
  return parseFromApi(adminNodeTokenSchema, data);
};
