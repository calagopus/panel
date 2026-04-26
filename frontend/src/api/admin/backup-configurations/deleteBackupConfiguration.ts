import { axiosInstance } from '@/api/axios.ts';

export default async (backupConfigUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/backup-configurations/${backupConfigUuid}`);
};
