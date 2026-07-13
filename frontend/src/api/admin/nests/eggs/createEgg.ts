import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { adminEggCreateSchema, adminEggSchema } from '@/lib/schemas/admin/eggs.ts';

export default async (
  nestUuid: string,
  eggData: z.infer<typeof adminEggCreateSchema>,
): Promise<z.infer<typeof adminEggSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/admin/nests/${nestUuid}/eggs`,
    serializeForApi(adminEggCreateSchema, eggData),
  );
  return parseFromApi(adminEggSchema, data.egg);
};
