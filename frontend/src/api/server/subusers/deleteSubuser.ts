import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, userUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${uuid}/subusers/${userUuid}`);
};
