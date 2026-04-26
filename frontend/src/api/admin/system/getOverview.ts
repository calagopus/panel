import { axiosInstance } from '@/api/axios.ts';

export interface AdminSystemOverview {
  version: string;
  containerType: string;
  cpu: {
    name: string;
    brand: string;
    vendorId: string;
    frequencyMHz: number;
    cpuCount: number;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedBytesProcess: number;
  };
  cache: {
    version: string;
    totalCalls: number;
    totalHits: number;
    totalMisses: number;
    averageCallLatencyNs: number;
  };
  database: {
    version: string;
    sizeBytes: number;
    totalReadConnections: number;
    idleReadConnections: number;
    totalWriteConnections: number;
    idleWriteConnections: number;
  };
  architecture: string;
  kernelVersion: string;
}

export default async (): Promise<AdminSystemOverview> => {
  const { data } = await axiosInstance.get('/api/admin/system/overview');
  return data;
};
