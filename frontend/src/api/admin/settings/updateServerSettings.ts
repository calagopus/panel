import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/api-transform.ts';
import { adminSettingsServerSchema } from '@/lib/schemas/admin/settings.ts';

export default async (data: z.infer<typeof adminSettingsServerSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    server: serializeForApi(adminSettingsServerSchema, data, formExtensionSchemas('admin.settings.server')),
  });
};
