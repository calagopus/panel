import { axiosInstance } from '@/api/axios.ts';

interface Data {
  ip?: string;
  ipAlias?: string | null;
}

export default async (
  nodeUuid: string,
  allocationUuids: string[],
  allocationData: Data,
): Promise<{ updated: number }> => {
  const { data } = await axiosInstance.patch(`/api/admin/nodes/${nodeUuid}/allocations`, {
    uuids: allocationUuids,
    ip: allocationData.ip,
    ip_alias: allocationData.ipAlias,
  });
  return data;
};
