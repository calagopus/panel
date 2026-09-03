import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeTunnelUpdateSchema } from '@/lib/schemas/admin/nodeTunnel.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (nodeUuid: string, data: z.infer<typeof adminNodeTunnelUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(`/api/admin/nodes/${nodeUuid}/tunnel`, serializeForApi(adminNodeTunnelUpdateSchema, data));
};
