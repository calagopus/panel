import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggRepositoryCountsSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminEggRepositoryCountsSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/egg-repositories/counts');
  return parseFromApi(adminEggRepositoryCountsSchema, data.egg_repositories);
};
