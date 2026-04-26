import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, allocationUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/servers/${serverUuid}/allocations/${allocationUuid}`);
};
