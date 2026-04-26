import { axiosInstance } from '@/api/axios.ts';

export default async (packageName: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/extensions/manage/${packageName}`);
};
