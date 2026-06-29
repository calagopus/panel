import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import {
  adminEggConfigurationSchema,
  adminEggConfigurationUpdateSchema,
} from '@/lib/schemas/admin/eggConfigurations.ts';

export default async (
  eggConfigurationData: z.infer<typeof adminEggConfigurationUpdateSchema>,
): Promise<z.infer<typeof adminEggConfigurationSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/egg-configurations',
    serializeForApi(adminEggConfigurationUpdateSchema, eggConfigurationData),
  );
  return data.eggConfiguration;
};
