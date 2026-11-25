import { axiosInstance } from '@/api/axios.ts';

export default async (teamUuid: string, userUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/teams/${teamUuid}/members/${userUuid}`);
};
