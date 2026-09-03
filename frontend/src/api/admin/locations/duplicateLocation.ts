import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (locationUuid: string, name: string): Promise<z.infer<typeof adminLocationSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/locations/${locationUuid}/duplicate`, { name });
  return parseFromApi(adminLocationSchema, data.location);
};
