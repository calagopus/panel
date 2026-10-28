import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggCountsSchema } from '@/lib/schemas/admin/eggs.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminEggCountsSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/eggs/counts');
  return parseFromApi(adminEggCountsSchema, data.nest_eggs);
};
