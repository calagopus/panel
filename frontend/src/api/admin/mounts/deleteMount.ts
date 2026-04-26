import { axiosInstance } from '@/api/axios.ts';

export default async (mountUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/mounts/${mountUuid}`);
};
