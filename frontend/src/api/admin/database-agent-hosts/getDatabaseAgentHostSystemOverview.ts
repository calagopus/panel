import { axiosInstance } from '@/api/axios.ts';

export interface DatabaseAgentHostSystemOverview {
  version: string;
  containerType: string;
  cpu: {
    name: string;
    brand: string;
    vendorId: string;
    frequencyMhz: number;
    cpuCount: number;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedBytesProcess: number;
  };
  databases: {
    total: number;
    online: number;
    offline: number;
  };
  architecture: string;
  kernelVersion: string;
}

export default async (hostUuid: string): Promise<DatabaseAgentHostSystemOverview> => {
  const { data } = await axiosInstance.get(`/api/admin/database-agent-hosts/${hostUuid}/system/overview`);
  return data;
};
