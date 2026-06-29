import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminNodeUpdateSchema } from '@/lib/schemas/admin/nodes.ts';

export default async (nodeUuid: string, data: z.infer<typeof adminNodeUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(`/api/admin/nodes/${nodeUuid}`, serializeForApi(adminNodeUpdateSchema, data));
};
