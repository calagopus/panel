import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { adminEggVariableSchema, adminEggVariableUpdateSchema } from '@/lib/schemas/admin/eggs.ts';

export default async (
  nestUuid: string,
  eggUuid: string,
  eggVariableData: z.infer<typeof adminEggVariableUpdateSchema>,
): Promise<z.infer<typeof adminEggVariableSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/admin/nests/${nestUuid}/eggs/${eggUuid}/variables`,
    serializeForApi(adminEggVariableUpdateSchema, eggVariableData, formExtensionSchemas('admin.nests.eggs.variables')),
  );
  return parseFromApi(adminEggVariableSchema, data.variable);
};
