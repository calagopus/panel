import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { adminLocationSchema, adminLocationUpdateSchema } from '@/lib/schemas/admin/locations.ts';

export default async (
  locationData: z.infer<typeof adminLocationUpdateSchema>,
): Promise<z.infer<typeof adminLocationSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/locations',
    serializeForApi(adminLocationUpdateSchema, locationData),
  );
  return parseFromApi(adminLocationSchema, data.location);
};
