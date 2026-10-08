import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeBandwidthSchema } from '@/lib/schemas/admin/nodes.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (nodeUuid: string): Promise<z.infer<typeof adminNodeBandwidthSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/bandwidth`);
  return parseFromApi(adminNodeBandwidthSchema, data);
};
