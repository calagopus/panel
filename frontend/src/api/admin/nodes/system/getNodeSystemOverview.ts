import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';

const nodeSystemOverviewSchema = z.object({
  version: z.string(),
  containerType: z.string(),
  cpu: z.object({
    name: z.string(),
    brand: z.string(),
    vendorId: z.string(),
    frequencyMhz: z.number(),
    cpuCount: z.number(),
  }),
  memory: z.object({
    totalBytes: z.number(),
    freeBytes: z.number(),
    usedBytes: z.number(),
    usedBytesProcess: z.number(),
  }),
  servers: z.object({
    total: z.number(),
    online: z.number(),
    offline: z.number(),
  }),
  architecture: z.string(),
  kernelVersion: z.string(),
});

export type NodeSystemOverview = z.infer<typeof nodeSystemOverviewSchema>;

export default async (nodeUuid: string): Promise<NodeSystemOverview> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/system/overview`);
  return parseFromApi(nodeSystemOverviewSchema, data);
};
