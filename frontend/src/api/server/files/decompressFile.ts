import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, root: string, file: string): Promise<string> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/files/decompress`, { root, file });
  return data.identifier;
};
