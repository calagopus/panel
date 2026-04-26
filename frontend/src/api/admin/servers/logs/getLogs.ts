import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, lines: number): Promise<string> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/${serverUuid}/logs`, {
    params: { lines },
    responseType: 'text',
  });
  return data;
};
