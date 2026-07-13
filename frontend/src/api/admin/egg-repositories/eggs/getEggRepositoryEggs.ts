import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminEggRepositoryEggSchema } from '@/lib/schemas/admin/eggRepositories.ts';

export default async (
  eggRepositoryUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminEggRepositoryEggSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/egg-repositories/${eggRepositoryUuid}/eggs`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminEggRepositoryEggSchema, data.egg_repository_eggs);
};
