import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggVariableSchema } from '@/lib/schemas/admin/eggs.ts';

export default async (nestUuid: string, eggUuid: string): Promise<z.infer<typeof adminEggVariableSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}/variables`);
  return data.variables;
};
