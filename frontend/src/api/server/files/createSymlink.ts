import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, root: string, link: string, target: string): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/files/create-symlink`, { root, link, target });
};
