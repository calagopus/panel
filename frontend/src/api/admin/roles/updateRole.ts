import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminRoleUpdateSchema } from '@/lib/schemas/admin/roles.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (roleUuid: string, data: z.infer<typeof adminRoleUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(`/api/admin/roles/${roleUuid}`, {
    ...transformKeysToSnakeCase(data),
    admin_permissions: Array.from(data.adminPermissions),
    server_permissions: Array.from(data.serverPermissions),
  });
};
