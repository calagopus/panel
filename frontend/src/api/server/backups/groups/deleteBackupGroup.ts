import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, groupUuid: string, lockBackups: boolean): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${serverUuid}/backups/groups/${groupUuid}`, {
    data: { lock_backups: lockBackups },
  });
};
