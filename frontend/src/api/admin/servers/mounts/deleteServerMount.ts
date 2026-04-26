import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, mountUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/servers/${serverUuid}/mounts/${mountUuid}`);
};
