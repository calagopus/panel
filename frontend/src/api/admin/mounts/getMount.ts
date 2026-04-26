import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';

export default async (mountUuid: string): Promise<z.infer<typeof adminMountSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/mounts/${mountUuid}`);
  return data.mount;
};
