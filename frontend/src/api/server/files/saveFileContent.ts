import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, file: string, content: string): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/files/write`, content, {
    params: { file },
    headers: {
      'Content-Type': 'text/plain',
    },
  });
};
