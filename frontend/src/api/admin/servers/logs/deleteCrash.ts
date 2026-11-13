import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, crashId: number): Promise<void> => {
  await axiosInstance.delete(`/api/admin/servers/${uuid}/logs/crashes/${crashId}`);
};
