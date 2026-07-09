import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';

const adminSystemOverviewSchema = z.object({
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
  cache: z.object({
    version: z.string(),
    totalCalls: z.number(),
    totalHits: z.number(),
    totalMisses: z.number(),
    averageCallLatencyNs: z.number(),
    maxCallLatencyNs: z.number(),
  }),
  database: z.object({
    version: z.string(),
    sizeBytes: z.number(),
    totalReadConnections: z.number(),
    idleReadConnections: z.number(),
    totalWriteConnections: z.number(),
    idleWriteConnections: z.number(),
  }),
  architecture: z.string(),
  kernelVersion: z.string(),
});

export type AdminSystemOverview = z.infer<typeof adminSystemOverviewSchema>;

export default async (): Promise<AdminSystemOverview> => {
  const { data } = await axiosInstance.get('/api/admin/system/overview');
  return parseFromApi(adminSystemOverviewSchema, data);
};
