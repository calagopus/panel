import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, path: string): Promise<Blob> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/files/contents`, {
    params: { file: path },
    responseType: 'blob',
  });
  return data;
};
