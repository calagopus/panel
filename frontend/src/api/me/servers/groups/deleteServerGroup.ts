import { axiosInstance } from '@/api/axios.ts';

export default async (serverGroupUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/groups/${serverGroupUuid}`);
};
