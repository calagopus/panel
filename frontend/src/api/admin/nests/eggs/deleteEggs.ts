import { axiosInstance } from '@/api/axios.ts';

export default async (nestUuid: string, eggUuids: string[]): Promise<{ deleted: number }> => {
  const { data } = await axiosInstance.post(`/api/admin/nests/${nestUuid}/eggs/delete`, { egg_uuids: eggUuids });
  return data;
};
