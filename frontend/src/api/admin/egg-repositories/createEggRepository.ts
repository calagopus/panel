import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { adminEggRepositorySchema, adminEggRepositoryUpdateSchema } from '@/lib/schemas/admin/eggRepositories.ts';

export default async (
  eggRepositoryData: z.infer<typeof adminEggRepositoryUpdateSchema>,
): Promise<z.infer<typeof adminEggRepositorySchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/egg-repositories',
    serializeForApi(adminEggRepositoryUpdateSchema, eggRepositoryData),
  );
  return parseFromApi(adminEggRepositorySchema, data.egg_repository);
};
