import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof adminEggRepositorySchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/egg-repositories', {
    params: { page, search },
  });
  return data.eggRepositories;
};
