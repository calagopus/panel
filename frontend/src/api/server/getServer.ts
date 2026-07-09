import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';

export default async (uuid: string): Promise<z.infer<typeof serverSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}`);
  return parseFromApi(serverSchema, data.server);
};
