import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, databaseUuid: string): Promise<number> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/${databaseUuid}/size`);
  return data.size;
};
