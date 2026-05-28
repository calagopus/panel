import { axiosInstance } from '@/api/axios.ts';

export default async (): Promise<{ enabled: boolean; default: boolean }> => {
  const { data } = await axiosInstance.get('/api/admin/system/debug');
  return data;
};
