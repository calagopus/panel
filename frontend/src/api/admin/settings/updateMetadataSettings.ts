import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsMetadataSchema } from '@/lib/schemas/admin/settings.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (data: z.infer<typeof adminSettingsMetadataSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    metadata: serializeForApi(adminSettingsMetadataSchema, data, formExtensionSchemas('admin.settings.metadata')),
  });
};
