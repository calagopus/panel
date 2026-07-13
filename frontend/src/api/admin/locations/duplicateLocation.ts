import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';

export default async (locationUuid: string, name: string): Promise<z.infer<typeof adminLocationSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/locations/${locationUuid}/duplicate`, { name });
  return parseFromApi(adminLocationSchema, data.location);
};
