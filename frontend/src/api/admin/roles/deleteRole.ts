import { axiosInstance } from '@/api/axios.ts';

export default async (roleUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/roles/${roleUuid}`);
};
