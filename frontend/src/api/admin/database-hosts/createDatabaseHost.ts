import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseHostCreateSchema, adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  databaseHostData: z.infer<typeof adminDatabaseHostCreateSchema>,
): Promise<z.infer<typeof adminDatabaseHostSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/database-hosts', transformKeysToSnakeCase(databaseHostData));
  return data.databaseHost;
};
