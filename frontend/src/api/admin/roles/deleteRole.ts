import { axiosInstance } from '@/api/axios.ts';

export default async (nestUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/roles/${nestUuid}`);
};
