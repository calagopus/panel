import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggVariableUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  nestUuid: string,
  eggUuid: string,
  variableUuid: string,
  data: z.infer<typeof adminEggVariableUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/nests/${nestUuid}/eggs/${eggUuid}/variables/${variableUuid}`,
    transformKeysToSnakeCase(data),
  );
};
