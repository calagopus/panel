import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNestCountsSchema } from '@/lib/schemas/admin/nests.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminNestCountsSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/nests/counts');
  return parseFromApi(adminNestCountsSchema, data.nests);
};
