import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, backupUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${uuid}/backups/${backupUuid}`);
};
