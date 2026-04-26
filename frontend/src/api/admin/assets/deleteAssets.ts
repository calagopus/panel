import { axiosInstance } from '@/api/axios.ts';

export default async (assetNames: string[]): Promise<{ deleted: number }> => {
  const { data } = await axiosInstance.post('/api/admin/assets/delete', { names: assetNames });
  return data;
};
