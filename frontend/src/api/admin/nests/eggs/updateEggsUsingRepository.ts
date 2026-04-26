import { axiosInstance } from '@/api/axios.ts';

export default async (nestUuid: string, eggUuids: string[]): Promise<{ updated: number }> => {
  const { data } = await axiosInstance.post(`/api/admin/nests/${nestUuid}/eggs/update/repository`, {
    egg_uuids: eggUuids,
  });
  return data;
};
