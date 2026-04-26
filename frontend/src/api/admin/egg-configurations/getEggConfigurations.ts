import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggConfigurationSchema } from '@/lib/schemas/admin/eggConfigurations.ts';

export default async (
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminEggConfigurationSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/egg-configurations', {
    params: { page, search },
  });
  return data.eggConfigurations;
};
