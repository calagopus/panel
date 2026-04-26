import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminLocationSchema, adminLocationUpdateSchema } from '@/lib/schemas/admin/locations.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  locationData: z.infer<typeof adminLocationUpdateSchema>,
): Promise<z.infer<typeof adminLocationSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/locations', transformKeysToSnakeCase(locationData));
  return data.location;
};
