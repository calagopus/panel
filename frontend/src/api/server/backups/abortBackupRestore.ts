import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string): Promise<boolean> => {
  const { status } = await axiosInstance.delete(`/api/client/servers/${uuid}/backups/restore`);
  return status === 200;
};
