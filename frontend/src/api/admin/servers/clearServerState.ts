import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/servers/${serverUuid}/clear-state`, {});
};
