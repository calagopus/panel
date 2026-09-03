import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverTunnelConnectionCreateSchema } from '@/lib/schemas/server/tunnel.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string, data: z.infer<typeof serverTunnelConnectionCreateSchema>): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/tunnel/connections`,
    serializeForApi(serverTunnelConnectionCreateSchema, data),
  );
};
