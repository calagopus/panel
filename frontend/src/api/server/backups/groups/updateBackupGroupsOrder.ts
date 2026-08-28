import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, order: string[]): Promise<void> => {
  await axiosInstance.put(`/api/client/servers/${serverUuid}/backups/groups/order`, { backup_group_order: order });
};
