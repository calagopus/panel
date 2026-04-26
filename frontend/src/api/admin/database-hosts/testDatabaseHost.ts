import { axiosInstance } from '@/api/axios.ts';

export default async (hostUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/database-hosts/${hostUuid}/test`);
};
