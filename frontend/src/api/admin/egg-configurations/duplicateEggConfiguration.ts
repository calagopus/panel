import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggConfigurationSchema } from '@/lib/schemas/admin/eggConfigurations.ts';

export default async (
  eggConfigurationUuid: string,
  name: string,
): Promise<z.infer<typeof adminEggConfigurationSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/egg-configurations/${eggConfigurationUuid}/duplicate`, {
    name,
  });
  return data.eggConfiguration;
};
