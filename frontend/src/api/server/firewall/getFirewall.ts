import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverFirewallSchema } from '@/lib/schemas/server/firewall.ts';

export default async (uuid: string): Promise<z.infer<typeof serverFirewallSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/firewall`);
  return parseFromApi(serverFirewallSchema, data);
};
