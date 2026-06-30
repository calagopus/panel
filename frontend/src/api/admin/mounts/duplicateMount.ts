import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';

export default async (
  mountUuid: string,
  name: string,
  source: string,
  target: string,
): Promise<z.infer<typeof adminMountSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/mounts/${mountUuid}/duplicate`, { name, source, target });
  return data.mount;
};
