import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerCreateSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  serverData: z.infer<typeof adminServerCreateSchema>,
): Promise<z.infer<typeof adminServerSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/servers', transformKeysToSnakeCase(serverData));
  return data.server;
};
