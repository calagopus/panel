import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, allocationUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${uuid}/allocations/${allocationUuid}`);
};
