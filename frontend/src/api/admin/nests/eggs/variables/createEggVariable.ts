import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggVariableSchema, adminEggVariableUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  nestUuid: string,
  eggUuid: string,
  eggVariableData: z.infer<typeof adminEggVariableUpdateSchema>,
): Promise<z.infer<typeof adminEggVariableSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/admin/nests/${nestUuid}/eggs/${eggUuid}/variables`,
    transformKeysToSnakeCase(eggVariableData),
  );
  return data.variable;
};
