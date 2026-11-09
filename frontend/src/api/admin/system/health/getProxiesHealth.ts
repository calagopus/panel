import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

const proxiesHealthSchema = z.object({
  activeUsers: z.number(),
  suspiciousIps: z.array(
    z.object({
      ip: z.string(),
      users: z.number(),
      sessions: z.number(),
      trusted: z.boolean(),
    }),
  ),
});

export default async (): Promise<z.infer<typeof proxiesHealthSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/system/health/proxies');
  return parseFromApi(proxiesHealthSchema, data);
};
