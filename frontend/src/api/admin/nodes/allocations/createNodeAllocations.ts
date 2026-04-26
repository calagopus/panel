import { axiosInstance } from '@/api/axios.ts';

interface Data {
  ip: string;
  ipAlias: string | null;
  ports: number[];
}

export default async (nodeUuid: string, allocationData: Data): Promise<{ created: number }> => {
  const { data } = await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/allocations`, {
    ip: allocationData.ip,
    ip_alias: allocationData.ipAlias,
    ports: allocationData.ports,
  });
  return data;
};
