import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, file: string, lines: number): Promise<Blob> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/system/logs/${encodeURIComponent(file)}`, {
    params: { lines },
    responseType: 'blob',
  });
  return data;
};
