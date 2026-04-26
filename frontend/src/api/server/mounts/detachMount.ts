import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, mountUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${uuid}/mounts/${mountUuid}`);
};
