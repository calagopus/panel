import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverMountSchema } from '@/lib/schemas/server/mounts.ts';

export default async (uuid: string): Promise<Pagination<z.infer<typeof serverMountSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/mounts`);
  return data.mounts;
};
