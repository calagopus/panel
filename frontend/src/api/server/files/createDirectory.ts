import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, root: string, name: string): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/files/create-directory`, { root, name });
};
