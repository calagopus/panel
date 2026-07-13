import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, instanceUuid: string, lines: number): Promise<string> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/instances/${instanceUuid}/logs`, {
    params: { lines },
    responseType: 'text',
  });
  return data;
};
