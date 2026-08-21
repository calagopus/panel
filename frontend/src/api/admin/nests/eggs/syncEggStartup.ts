import { axiosInstance } from '@/api/axios.ts';

export default async (nestUuid: string, eggUuid: string, startup: string): Promise<{ synced: number }> => {
  const { data } = await axiosInstance.post(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}/sync-startup`, {
    startup,
  });
  return data;
};
