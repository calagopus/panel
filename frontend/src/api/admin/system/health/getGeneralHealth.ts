import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';

const generalHealthSchema = z.object({
  localTime: z.string(),
  ntpOffsets: z.record(z.string(), z.object({ offsetMicros: z.number() })),
  migrations: z.object({
    total: z.number(),
    applied: z.number(),
    extensions: z.record(z.string(), z.object({ total: z.number(), applied: z.number() })),
  }),
});

export default async (): Promise<z.infer<typeof generalHealthSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/system/health/general');
  return parseFromApi(generalHealthSchema, data);
};
