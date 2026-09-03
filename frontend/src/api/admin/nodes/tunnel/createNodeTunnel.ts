import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeTunnelCreateSchema } from '@/lib/schemas/admin/nodeTunnel.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (nodeUuid: string, data: z.infer<typeof adminNodeTunnelCreateSchema>): Promise<void> => {
  await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/tunnel`, serializeForApi(adminNodeTunnelCreateSchema, data));
};
