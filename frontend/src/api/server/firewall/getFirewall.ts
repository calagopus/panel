import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverFirewallSchema } from '@/lib/schemas/server/firewall.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string): Promise<z.infer<typeof serverFirewallSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/firewall`);
  return parseFromApi(serverFirewallSchema, data);
};
