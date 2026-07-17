import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminEggVariableSchema } from '@/lib/schemas/admin/eggs.ts';

export default async (
  nestUuid: string,
  eggUuid: string,
  variableUuid: string,
  name: string,
  envVariable: string,
): Promise<z.infer<typeof adminEggVariableSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/admin/nests/${nestUuid}/eggs/${eggUuid}/variables/${variableUuid}/duplicate`,
    { name, env_variable: envVariable },
  );
  return parseFromApi(adminEggVariableSchema, data.variable);
};
