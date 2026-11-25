import { axiosInstance } from '@/api/axios.ts';

export default async (teamUuid: string, userUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/teams/${teamUuid}/members/${userUuid}`);
};
