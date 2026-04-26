import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';

export default async (nestUuid: string, eggUuid: string): Promise<z.infer<typeof adminEggSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}`);
  return data.egg;
};
