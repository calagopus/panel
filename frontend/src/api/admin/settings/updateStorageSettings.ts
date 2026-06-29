import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminSettingsStorageSchema } from '@/lib/schemas/admin/settings.ts';

export default async (data: z.infer<typeof adminSettingsStorageSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    storage_driver: serializeForApi(adminSettingsStorageSchema, data),
  });
};
