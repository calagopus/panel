import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, subuser: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${uuid}/subusers/${subuser}`);
};
