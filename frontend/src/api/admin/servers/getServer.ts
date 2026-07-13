import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';

export default async (serverUuid: string): Promise<z.infer<typeof adminServerSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/${serverUuid}`);
  return parseFromApi(adminServerSchema, data.server);
};
