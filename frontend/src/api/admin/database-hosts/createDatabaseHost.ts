import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseHostCreateSchema, adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  databaseHostData: z.infer<typeof adminDatabaseHostCreateSchema>,
): Promise<z.infer<typeof adminDatabaseHostSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/database-hosts',
    serializeForApi(adminDatabaseHostCreateSchema, databaseHostData, [
      ...formExtensionSchemas('admin.databaseHosts.createOrUpdate'),
      ...formExtensionSchemas('admin.databaseHosts.credentialDetails'),
    ]),
  );
  return parseFromApi(adminDatabaseHostSchema, data.database_host);
};
