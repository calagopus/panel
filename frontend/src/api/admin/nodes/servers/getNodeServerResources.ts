import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverResourceUsageSchema } from '@/lib/schemas/server/server.ts';

export default async (nodeUuid: string): Promise<Record<string, z.infer<typeof serverResourceUsageSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/servers/resources`);
  return data.resources;
};
