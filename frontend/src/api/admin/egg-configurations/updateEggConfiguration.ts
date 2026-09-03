import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggConfigurationUpdateSchema } from '@/lib/schemas/admin/eggConfigurations.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

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
