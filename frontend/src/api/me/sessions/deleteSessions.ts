import { axiosInstance } from '@/api/axios.ts';

export default async (): Promise<{ deleted: number }> => {
  const { data } = await axiosInstance.delete('/api/client/account/sessions');
  return data;
};
