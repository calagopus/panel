import { axiosInstance } from '@/api/axios.ts';

export default async (hostUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/database-hosts/${hostUuid}`);
};
