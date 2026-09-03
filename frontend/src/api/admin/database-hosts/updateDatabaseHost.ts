import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseHostUpdateSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (hostUuid: string, data: z.infer<typeof adminDatabaseHostUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/database-hosts/${hostUuid}`,
    serializeForApi(adminDatabaseHostUpdateSchema, data, [
      ...formExtensionSchemas('admin.databaseHosts.createOrUpdate'),
      ...formExtensionSchemas('admin.databaseHosts.credentialDetails'),
    ]),
  );
};
