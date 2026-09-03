import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string): Promise<z.infer<typeof serverSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}`);
  return parseFromApi(serverSchema, data.server);
};
