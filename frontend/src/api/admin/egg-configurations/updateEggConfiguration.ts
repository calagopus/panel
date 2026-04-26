import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggConfigurationUpdateSchema } from '@/lib/schemas/admin/eggConfigurations.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  eggConfigurationUuid: string,
  data: z.infer<typeof adminEggConfigurationUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(`/api/admin/egg-configurations/${eggConfigurationUuid}`, transformKeysToSnakeCase(data));
};
