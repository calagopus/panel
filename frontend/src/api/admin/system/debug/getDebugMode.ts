import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';

const debugModeSchema = z.object({
  enabled: z.boolean(),
  default: z.boolean(),
});

export default async (): Promise<z.infer<typeof debugModeSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/system/debug');
  return parseFromApi(debugModeSchema, data);
};
