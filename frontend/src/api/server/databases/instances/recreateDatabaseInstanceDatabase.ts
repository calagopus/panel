import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, instanceUuid: string, databaseUuid: string): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/recreate`,
  );
};
