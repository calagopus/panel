import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';

export default async (
  nestUuid: string,
  eggUuid: string,
  name: string,
  targetNestUuid: string,
): Promise<z.infer<typeof adminEggSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}/duplicate`, {
    name,
    nest_uuid: targetNestUuid,
  });
  return data.egg;
};
