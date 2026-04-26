import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string): Promise<boolean> => {
  const { status } = await axiosInstance.post(`/api/client/servers/${uuid}/settings/install/cancel`);
  return status === 200;
};
