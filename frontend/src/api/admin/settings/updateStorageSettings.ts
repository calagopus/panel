import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsStorageSchema } from '@/lib/schemas/admin/settings.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (data: z.infer<typeof adminSettingsStorageSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    storage_driver: serializeForApi(adminSettingsStorageSchema, data, [
      ...formExtensionSchemas('admin.settings.storage.filesystem'),
      ...formExtensionSchemas('admin.settings.storage.s3'),
    ]),
  });
};
