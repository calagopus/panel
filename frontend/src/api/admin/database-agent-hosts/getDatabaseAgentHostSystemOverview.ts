import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';

const databaseAgentHostSystemOverviewSchema = z.object({
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
  instances: z.object({
    total: z.number(),
    online: z.number(),
    offline: z.number(),
  }),
  architecture: z.string(),
  kernelVersion: z.string(),
  localTime: z.coerce.date(),
});

export type DatabaseAgentHostSystemOverview = z.infer<typeof databaseAgentHostSystemOverviewSchema>;

export default async (hostUuid: string): Promise<DatabaseAgentHostSystemOverview> => {
  const { data } = await axiosInstance.get(`/api/admin/database-agent-hosts/${hostUuid}/system/overview`);
  return parseFromApi(databaseAgentHostSystemOverviewSchema, data);
};
