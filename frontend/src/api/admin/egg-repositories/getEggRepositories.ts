import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof adminEggRepositorySchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/egg-repositories', {
    params: { page, search },
  });
  return parsePaginationFromApi(adminEggRepositorySchema, data.egg_repositories);
};
