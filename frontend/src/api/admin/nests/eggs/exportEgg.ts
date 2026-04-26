import { untransformedAxiosInstance } from '@/api/axios.ts';

export default async (nestUuid: string, eggUuid: string): Promise<object> => {
  const { data } = await untransformedAxiosInstance.get(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}/export`);
  return data;
};
