import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, backupUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/backups/${backupUuid}/detach`);
};
