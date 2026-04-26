import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, databaseUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${uuid}/databases/${databaseUuid}`);
};
