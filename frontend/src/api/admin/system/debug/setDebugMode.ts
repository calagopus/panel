import { axiosInstance } from '@/api/axios.ts';

export default async (enabled: boolean): Promise<void> => {
  await axiosInstance.post('/api/admin/system/debug', { enabled });
};
