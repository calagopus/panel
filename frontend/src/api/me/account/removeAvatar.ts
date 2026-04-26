import { axiosInstance } from '@/api/axios.ts';

export default async (): Promise<void> => {
  await axiosInstance.delete('/api/client/account/avatar');
};
