import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggConfigurationSchema } from '@/lib/schemas/admin/eggConfigurations.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  eggConfigurationUuid: string,
  name: string,
): Promise<z.infer<typeof adminEggConfigurationSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/egg-configurations/${eggConfigurationUuid}/duplicate`, {
    name,
  });
  return parseFromApi(adminEggConfigurationSchema, data.egg_configuration);
};
