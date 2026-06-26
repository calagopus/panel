import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminDatabaseHostCreateSchema, adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';

export default async (
  databaseHostData: z.infer<typeof adminDatabaseHostCreateSchema>,
): Promise<z.infer<typeof adminDatabaseHostSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/database-hosts',
    serializeForApi(adminDatabaseHostCreateSchema, databaseHostData),
  );
  return data.databaseHost;
};
