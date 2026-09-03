import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminRoleUpdateSchema } from '@/lib/schemas/admin/roles.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (roleUuid: string, data: z.infer<typeof adminRoleUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/roles/${roleUuid}`,
    serializeForApi(adminRoleUpdateSchema, data, formExtensionSchemas('admin.roles.createOrUpdate')),
  );
};
