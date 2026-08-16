import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, databaseUuid: string): Promise<string[]> => {
  const { data } = await axiosInstance.get(
    `/api/client/servers/${uuid}/databases/${databaseUuid}/explorer/tables/types`,
  );
  return data.types;
};
