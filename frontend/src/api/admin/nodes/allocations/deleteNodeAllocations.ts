import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, allocationUuids: string[]): Promise<{ deleted: number }> => {
  const { data } = await axiosInstance.delete(`/api/admin/nodes/${nodeUuid}/allocations`, {
    data: { uuids: allocationUuids },
  });
  return data;
};
