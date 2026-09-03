import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (mountUuid: string): Promise<z.infer<typeof adminMountSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/mounts/${mountUuid}`);
  return parseFromApi(adminMountSchema, data.mount);
};
