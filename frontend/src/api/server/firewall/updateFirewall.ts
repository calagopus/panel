import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverFirewallEditSchema } from '@/lib/schemas/server/firewall.ts';

export default async (uuid: string, data: z.infer<typeof serverFirewallEditSchema>): Promise<void> => {
  await axiosInstance.put(`/api/client/servers/${uuid}/firewall`, serializeForApi(serverFirewallEditSchema, data));
};
