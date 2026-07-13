import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/api-transform.ts';
import { adminEggConfigurationUpdateSchema } from '@/lib/schemas/admin/eggConfigurations.ts';

export default async (
  eggConfigurationUuid: string,
  data: z.infer<typeof adminEggConfigurationUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/egg-configurations/${eggConfigurationUuid}`,
    serializeForApi(
      adminEggConfigurationUpdateSchema,
      data,
      formExtensionSchemas('admin.eggConfigurations.createOrUpdate'),
    ),
  );
};
