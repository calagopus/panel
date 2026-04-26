import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';

export default async (locationUuid: string): Promise<z.infer<typeof adminLocationSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/locations/${locationUuid}`);
  return data.location;
};
