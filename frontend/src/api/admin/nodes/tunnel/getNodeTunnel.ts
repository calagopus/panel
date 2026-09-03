import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeTunnelViewSchema } from '@/lib/schemas/admin/nodeTunnel.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (nodeUuid: string): Promise<z.infer<typeof adminNodeTunnelViewSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/tunnel`);
  return parseFromApi(adminNodeTunnelViewSchema, data);
};
