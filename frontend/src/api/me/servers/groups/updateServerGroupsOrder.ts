import { axiosInstance } from '@/api/axios.ts';

export default async (order: string[]): Promise<void> => {
  await axiosInstance.put('/api/client/servers/groups/order', { server_group_order: order });
};
