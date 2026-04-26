import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, databaseUuid: string): Promise<string | null> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/databases/${databaseUuid}/rotate-password`);
  return data.password;
};
