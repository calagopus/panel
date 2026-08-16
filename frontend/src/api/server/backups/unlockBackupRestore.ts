import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/backups/unlock`);
};
