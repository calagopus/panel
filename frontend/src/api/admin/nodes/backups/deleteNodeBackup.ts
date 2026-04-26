import { axiosInstance } from '@/api/axios.ts';

interface Data {
  force: boolean;
}

export default async (nodeUuid: string, backupUuid: string, data: Data): Promise<void> => {
  await axiosInstance.delete(`/api/admin/nodes/${nodeUuid}/backups/${backupUuid}`, { data });
};
