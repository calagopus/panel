import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverTunnelSchema } from '@/lib/schemas/server/tunnel.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string): Promise<z.infer<typeof serverTunnelSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/tunnel`);
  return parseFromApi(serverTunnelSchema, data);
};
