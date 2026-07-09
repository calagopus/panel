import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';

export default async (nestUuid: string, eggData: object): Promise<z.infer<typeof adminEggSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/nests/${nestUuid}/eggs/import`, eggData);
  return parseFromApi(adminEggSchema, data.egg);
};
