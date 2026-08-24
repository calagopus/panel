import { axiosInstance } from '@/api/axios.ts';

export default async (packageName: string, enabled: boolean): Promise<void> => {
  await axiosInstance.patch(`/api/admin/extensions/${packageName}`, { enabled });
};
