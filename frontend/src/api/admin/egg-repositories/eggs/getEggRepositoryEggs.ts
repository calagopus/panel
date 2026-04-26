import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggRepositoryEggSchema } from '@/lib/schemas/admin/eggRepositories.ts';

export default async (
  eggRepositoryUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminEggRepositoryEggSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/egg-repositories/${eggRepositoryUuid}/eggs`, {
    params: { page, search },
  });
  return data.eggRepositoryEggs;
};
