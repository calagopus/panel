import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';

export default async (eggRepositoryUuid: string): Promise<z.infer<typeof adminEggRepositorySchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/egg-repositories/${eggRepositoryUuid}`);
  return data.eggRepository;
};
