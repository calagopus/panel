import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (locationUuid: string): Promise<z.infer<typeof adminLocationSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/locations/${locationUuid}`);
  return parseFromApi(adminLocationSchema, data.location);
};
