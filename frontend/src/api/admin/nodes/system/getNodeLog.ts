import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, file: string, lines: number): Promise<string> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/system/logs/${encodeURIComponent(file)}`, {
    params: { lines },
    responseType: 'text',
  });
  return data;
};
