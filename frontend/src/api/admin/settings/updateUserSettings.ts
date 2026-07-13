import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/api-transform.ts';
import { adminSettingsUserSchema } from '@/lib/schemas/admin/settings.ts';

export default async (data: z.infer<typeof adminSettingsUserSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    user: serializeForApi(adminSettingsUserSchema, data, formExtensionSchemas('admin.settings.user')),
  });
};
