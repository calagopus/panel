import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggRepositorySchema, adminEggRepositoryUpdateSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  eggRepositoryData: z.infer<typeof adminEggRepositoryUpdateSchema>,
): Promise<z.infer<typeof adminEggRepositorySchema>> => {
  const { data } = await axiosInstance.post('/api/admin/egg-repositories', transformKeysToSnakeCase(eggRepositoryData));
  return data.eggRepository;
};
