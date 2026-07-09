import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';

export default async (mountUuid: string): Promise<z.infer<typeof adminMountSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/mounts/${mountUuid}`);
  return parseFromApi(adminMountSchema, data.mount);
};
