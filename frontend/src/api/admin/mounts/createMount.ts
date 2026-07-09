import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { adminMountSchema, adminMountUpdateSchema } from '@/lib/schemas/admin/mounts.ts';

export default async (mountData: z.infer<typeof adminMountUpdateSchema>): Promise<z.infer<typeof adminMountSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/mounts', serializeForApi(adminMountUpdateSchema, mountData));
  return parseFromApi(adminMountSchema, data.mount);
};
