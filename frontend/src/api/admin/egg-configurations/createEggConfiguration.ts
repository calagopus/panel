import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  adminEggConfigurationSchema,
  adminEggConfigurationUpdateSchema,
} from '@/lib/schemas/admin/eggConfigurations.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  eggConfigurationData: z.infer<typeof adminEggConfigurationUpdateSchema>,
): Promise<z.infer<typeof adminEggConfigurationSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/egg-configurations',
    serializeForApi(
      adminEggConfigurationUpdateSchema,
      eggConfigurationData,
      formExtensionSchemas('admin.eggConfigurations.createOrUpdate'),
    ),
  );
  return parseFromApi(adminEggConfigurationSchema, data.egg_configuration);
};
