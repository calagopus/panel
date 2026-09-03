import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsApplicationSchema } from '@/lib/schemas/admin/settings.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (data: z.infer<typeof adminSettingsApplicationSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    app: serializeForApi(adminSettingsApplicationSchema, data, formExtensionSchemas('admin.settings.application')),
  });
};
