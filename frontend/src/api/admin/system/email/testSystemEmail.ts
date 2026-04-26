import { axiosInstance } from '@/api/axios.ts';

export default async (email: string): Promise<void> => {
  await axiosInstance.post('/api/admin/system/email/test', {
    email,
  });
};
