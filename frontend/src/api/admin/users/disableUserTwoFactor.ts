import { axiosInstance } from '@/api/axios.ts';

export default async (userUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/users/${userUuid}/two-factor`);
};
