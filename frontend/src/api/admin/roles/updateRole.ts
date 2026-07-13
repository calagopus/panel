import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/api-transform.ts';
import { adminRoleUpdateSchema } from '@/lib/schemas/admin/roles.ts';

export default async (roleUuid: string, data: z.infer<typeof adminRoleUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/roles/${roleUuid}`,
    serializeForApi(adminRoleUpdateSchema, data, formExtensionSchemas('admin.roles.createOrUpdate')),
  );
};
