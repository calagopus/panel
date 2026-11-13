import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, crashId: number): Promise<string> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/logs/crashes/${crashId}`, {
    responseType: 'text',
  });
  return data;
};
