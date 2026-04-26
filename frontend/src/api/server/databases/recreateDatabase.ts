import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, databaseUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/databases/${databaseUuid}/recreate`);
};
