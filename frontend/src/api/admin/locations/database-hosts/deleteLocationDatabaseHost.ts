import { axiosInstance } from '@/api/axios.ts';

export default async (locationUuid: string, hostUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/locations/${locationUuid}/database-hosts/${hostUuid}`);
};
