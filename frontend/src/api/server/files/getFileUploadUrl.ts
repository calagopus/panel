import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, directory: string): Promise<{ url: string }> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/files/upload`);
  return { url: data.url + `&directory=${encodeURIComponent(directory)}` };
};
