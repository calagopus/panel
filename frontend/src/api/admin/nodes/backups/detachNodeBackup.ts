import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, backupUuid: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    axiosInstance
      .post(`/api/admin/nodes/${nodeUuid}/backups/${backupUuid}/detach`)
      .then(() => resolve())
      .catch(reject);
  });
};
