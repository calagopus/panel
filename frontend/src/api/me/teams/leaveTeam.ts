import { axiosInstance } from '@/api/axios.ts';

export default async (teamUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/teams/${teamUuid}/membership`);
};
