import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminEggConfigScriptSchema } from '@/lib/schemas/admin/eggs.ts';

export default async (
  nestUuid: string,
  eggUuid: string,
  data: z.infer<typeof adminEggConfigScriptSchema>,
): Promise<void> => {
  await axiosInstance.patch(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}`, {
    config_script: serializeForApi(adminEggConfigScriptSchema, data),
  });
};
