import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggVariableUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  nestUuid: string,
  eggUuid: string,
  variableUuid: string,
  data: z.infer<typeof adminEggVariableUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/nests/${nestUuid}/eggs/${eggUuid}/variables/${variableUuid}`,
    serializeForApi(adminEggVariableUpdateSchema, data, formExtensionSchemas('admin.nests.eggs.variables')),
  );
};
