import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';

export default async (
  nodeUuid: string,
  servers: string[],
  action: z.infer<typeof serverPowerAction>,
): Promise<number> => {
  const { data } = await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/servers/power`, {
    servers,
    action,
  });
  return data.affected;
};
