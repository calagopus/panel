import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverCrashSchema } from '@/lib/schemas/server/server.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string): Promise<z.infer<typeof serverCrashSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/${uuid}/logs/crashes`);
  return data.crashes.map((item: unknown) => parseFromApi(serverCrashSchema, item));
};
