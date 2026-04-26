import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';

export default async (uuid: string, action: z.infer<typeof serverPowerAction>): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/power`, {
    action,
  });
};
