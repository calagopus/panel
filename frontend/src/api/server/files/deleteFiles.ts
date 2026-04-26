import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, root: string, files: string[]): Promise<{ deleted: number }> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/files/delete`, { root, files });
  return data.deleted;
};
