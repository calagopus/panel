import { axiosInstance } from '@/api/axios.ts';

export default async (nestUuid: string, eggUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}`);
};
