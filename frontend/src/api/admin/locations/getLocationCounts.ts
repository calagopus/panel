import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminLocationCountsSchema } from '@/lib/schemas/admin/locations.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminLocationCountsSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/locations/counts');
  return parseFromApi(adminLocationCountsSchema, data.locations);
};
