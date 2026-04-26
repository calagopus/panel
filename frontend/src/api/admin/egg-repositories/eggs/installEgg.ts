import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';

export default async (
  eggRepositoryUuid: string,
  eggRepositoryEggUuid: string,
  nestUuid: string,
): Promise<z.infer<typeof adminEggSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/admin/egg-repositories/${eggRepositoryUuid}/eggs/${eggRepositoryEggUuid}/install`,
    {
      nest_uuid: nestUuid,
    },
  );
  return data.egg;
};
