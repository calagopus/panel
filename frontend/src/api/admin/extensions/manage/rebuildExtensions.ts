import { axiosInstance } from '@/api/axios.ts';

export default async (): Promise<void> => {
  await axiosInstance.post('/api/admin/extensions/manage/rebuild');
};
