import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';

export default async (locationUuid: string): Promise<z.infer<typeof adminLocationSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/locations/${locationUuid}`);
  return parseFromApi(adminLocationSchema, data.location);
};
