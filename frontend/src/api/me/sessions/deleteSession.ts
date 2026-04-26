import { axiosInstance } from '@/api/axios.ts';

export default async (sessionUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/account/sessions/${sessionUuid}`);
};
