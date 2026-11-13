import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, crashId: number): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${uuid}/logs/crashes/${crashId}`);
};
