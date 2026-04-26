import { axiosInstance } from '@/api/axios.ts';

export default async (serverGroupUuid: string, data: { name?: string; serverOrder?: string[] }): Promise<void> => {
  await axiosInstance.patch(`/api/client/servers/groups/${serverGroupUuid}`, {
    name: data.name,
    server_order: data.serverOrder,
  });
};
