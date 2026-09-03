import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeTransfersSchema } from '@/lib/schemas/admin/nodes.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (nodeUuid: string): Promise<z.infer<typeof adminNodeTransfersSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/transfers`);
  return parseFromApi(adminNodeTransfersSchema, data.transfers);
};
